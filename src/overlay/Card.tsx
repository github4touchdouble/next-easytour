"use client";

/**
 * @module overlay/Card
 *
 * The tutorial card. Three modes in 0.3.0-alpha.1+:
 *
 *   1. **Default** (`<Card />`) — minimal title/body/nav layout, no
 *      branding. Unchanged from alpha.0. Meant for examples, tests,
 *      and hosts that wire their own styles from scratch.
 *
 *   2. **Branded** (`<Card variant="branded" logo="/logo.svg" />`) —
 *      gradient accent header, logo slot, progress dots, primary
 *      accent Next button. New in alpha.1. Suitable as-is for most
 *      product tours; the gradient colour comes from `--eto-accent`.
 *
 *   3. **Render-prop** — full control over the card's internal markup.
 *      Receives the full tutorial API as an argument.
 *
 *          <Card>
 *            {({ step, index, total, next, prev, close }) => (
 *              <MyCompletelyCustomCard ... />
 *            )}
 *          </Card>
 *
 * In all three modes the outer `<div className="eto-card">` wrapper is
 * the library's. It handles:
 *
 *   - Positioning (from `step.cardAnchor`, or the sensible default:
 *     bottom-centre for steps with a target, viewport-centre for
 *     targetless steps — new in alpha.1).
 *   - Fixed layout so the card stays anchored during scroll.
 *   - Publishing its live `DOMRect` to `CardRectContext` so `<Arrow>`
 *     can route its origin to the nearest card edge.
 *   - Keyboard navigation (Escape → close, Arrow keys → prev/next).
 *   - Accessibility (role="dialog", aria-labelledby, focus on open).
 *
 * Renders nothing while the tour is closed.
 */

import * as React from "react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { useTutorial } from "../core/Tutorial";
import { useCardRectSetter } from "./Arrow";
import type { Rect } from "../core/useTargetRect";
import type { TutorialApi, CardVariant, BrandedCardProps } from "../types";

// ────────────────────────────────────────────────────────────────────────
// Render-prop signature
// ────────────────────────────────────────────────────────────────────────

/**
 * Arg passed to the render-prop form of `<Card>`. A pared-down view of
 * the full TutorialApi with every field most custom cards need, in a
 * stable shape that doesn't churn when the library adds fields.
 */
export interface CardRenderArgs<Meta = unknown> {
  step: NonNullable<TutorialApi<Meta>["step"]>;
  index: number;
  total: number;
  isFirst: boolean;
  isLast: boolean;
  canAdvance: boolean;
  next: () => void;
  prev: () => void;
  close: () => void;
}

type CardChildren<Meta = unknown> =
  | React.ReactNode
  | ((args: CardRenderArgs<Meta>) => React.ReactNode);

export interface CardProps<Meta = unknown> extends BrandedCardProps {
  /**
   * Render-prop children receive the tutorial API as an argument and
   * return fully custom JSX. A plain React node renders alongside the
   * library's default header/body/footer.
   *
   * Omit `children` entirely to use the `variant`-selected default.
   */
  children?: CardChildren<Meta>;
  /**
   * Layout variant for the built-in card. Ignored when `children` is
   * supplied (render-prop / custom children take over the content).
   * Default `"default"` preserves alpha.0 behaviour.
   */
  variant?: CardVariant;
  /**
   * Disable keyboard shortcuts (Esc / Arrow keys). Default false —
   * the library wires them by default for accessibility; opt out only
   * if they conflict with your host app.
   */
  disableKeyboard?: boolean;
}

// ────────────────────────────────────────────────────────────────────────
// Card component
// ────────────────────────────────────────────────────────────────────────

export function Card<Meta = unknown>(props: CardProps<Meta>) {
  const {
    children,
    disableKeyboard = false,
    variant = "default",
    logo,
    logoAlt,
    labels,
    accent,
    hideProgress,
  } = props;
  const api = useTutorial<Meta>();
  const { step, index, total, isFirst, isLast, canAdvance, next, prev, close } =
    api;

  // Unique ids for aria-labelledby / aria-describedby on non-custom cards.
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const bodyId = `${baseId}-body`;

  // ── Card rect publication ─────────────────────────────────────────────
  //
  // Card's bounding rect is consumed by both `<Arrow>` (for origin
  // routing) and `<EditorHandles>` (for positioning the card-drag
  // handle). Both sit OUTSIDE Card's DOM subtree — they're siblings
  // inside `<Tutorial>` — so the context holding this rect must be
  // mounted at the `<Tutorial>` level. We write to it via the
  // `useCardRectSetter` hook; the reader hook `useCardRect()` stays
  // unchanged for consumers.
  const cardRef = useRef<HTMLDivElement>(null);
  const setCardRect = useCardRectSetter();
  // Keep the most recent rect in a ref so the 0.5px-threshold dedupe
  // below doesn't need React state — we skip the setState call entirely
  // when the rect hasn't moved. Cheaper than re-running the provider
  // subscribers for sub-pixel drift.
  const lastRectRef = useRef<Rect | null>(null);

  useLayoutEffect(() => {
    if (!cardRef.current) return;
    if (!setCardRect) return;  // Card rendered outside a <Tutorial>.
    const el = cardRef.current;

    const read = () => {
      const r = el.getBoundingClientRect();
      const next: Rect = {
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      };
      const prev = lastRectRef.current;
      if (
        prev &&
        Math.abs(prev.left - next.left) < 0.5 &&
        Math.abs(prev.top - next.top) < 0.5 &&
        Math.abs(prev.width - next.width) < 0.5 &&
        Math.abs(prev.height - next.height) < 0.5
      ) {
        return;
      }
      lastRectRef.current = next;
      setCardRect(next);
    };

    read();
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(read) : null;
    ro?.observe(el);
    window.addEventListener("scroll", read, true);
    window.addEventListener("resize", read);
    return () => {
      ro?.disconnect();
      window.removeEventListener("scroll", read, true);
      window.removeEventListener("resize", read);
      // Clear the rect when Card unmounts so stale values don't linger
      // in the Tutorial-level store across tour close/reopen cycles.
      lastRectRef.current = null;
      setCardRect(null);
    };
  }, [step?.id, setCardRect]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  useEffect(() => {
    if (disableKeyboard) return;
    if (!step) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          // alpha.1 fix: blur the focused element before closing so
          // focus doesn't silently land back on a tour-originated
          // button after close.
          (document.activeElement as HTMLElement | null)?.blur?.();
          close();
          break;
        case "ArrowRight":
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
          e.preventDefault();
          prev();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disableKeyboard, step, next, prev, close]);

  // ── Positioning style ────────────────────────────────────────────────
  //
  // Precedence, top to bottom:
  //
  //   1. Explicit `step.cardAnchor` — literal top-left anchor in viewport %.
  //   2. Targetless steps (alpha.1) → viewport centre, so the card
  //      reads as a modal introduction rather than detached footer.
  //   3. Steps with targets → bottom-centre default (alpha.0 behaviour).
  //
  // `position: fixed` lives here, not in CSS, so hosts can opt into
  // `position: absolute` wrappers if they really want the card to flow
  // inline.
  const positionStyle = useMemo<React.CSSProperties>(() => {
    if (step?.cardAnchor) {
      return {
        position: "fixed",
        left: `${step.cardAnchor.x}vw`,
        top: `${step.cardAnchor.y}vh`,
      };
    }
    const hasTargets = (step?.targets?.length ?? 0) > 0;
    if (!hasTargets) {
      // alpha.1: targetless steps render centred.
      return {
        position: "fixed",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      };
    }
    return {
      position: "fixed",
      left: "50%",
      bottom: "1.5rem",
      transform: "translateX(-50%)",
    };
  }, [step?.cardAnchor, step?.targets]);

  // ── Early return ─────────────────────────────────────────────────────
  if (!step) return null;

  // ── Render-prop resolution ───────────────────────────────────────────
  const renderArgs: CardRenderArgs<Meta> = {
    step,
    index,
    total,
    isFirst,
    isLast,
    canAdvance,
    next,
    prev,
    close,
  };
  const isRenderProp = typeof children === "function";
  const rendered = isRenderProp
    ? (children as (a: CardRenderArgs<Meta>) => React.ReactNode)(renderArgs)
    : null;

  // ── Variant class composition ────────────────────────────────────────
  const isBranded = variant === "branded" && !children;
  const className = isBranded ? "eto-card eto-card--branded" : "eto-card";

  // Accent override is wired via CSS custom property so child elements
  // can read it through the cascade without prop-drilling.
  const styleWithAccent: React.CSSProperties = {
    ...positionStyle,
    ...(accent ? ({ ["--eto-branded-accent" as any]: accent } as React.CSSProperties) : {}),
  };

  return (
    <div
      ref={cardRef}
      className={className}
      style={styleWithAccent}
      role="dialog"
      aria-modal="false"
      aria-labelledby={!isRenderProp ? titleId : undefined}
      aria-describedby={!isRenderProp ? bodyId : undefined}
    >
      {isRenderProp ? (
        rendered
      ) : children ? (
        children
      ) : isBranded ? (
        <BrandedCardBody
          api={api as TutorialApi<unknown>}
          titleId={titleId}
          bodyId={bodyId}
          logo={logo}
          logoAlt={logoAlt}
          labels={labels}
          hideProgress={hideProgress}
        />
      ) : (
        <DefaultCardBody
          api={api as TutorialApi<unknown>}
          titleId={titleId}
          bodyId={bodyId}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Default body (alpha.0 layout; unchanged)
// ────────────────────────────────────────────────────────────────────────

function DefaultCardBody(props: {
  api: TutorialApi<unknown>;
  titleId: string;
  bodyId: string;
}) {
  const { api, titleId, bodyId } = props;
  const { step, index, total, isFirst, isLast, canAdvance, next, prev, close } =
    api;
  if (!step) return null;

  return (
    <>
      <div className="eto-header">
        <span className="eto-progress">
          {index + 1} / {total}
        </span>
        <button
          type="button"
          className="eto-close"
          onClick={close}
          aria-label="Close tutorial"
        >
          ×
        </button>
      </div>
      <div className="eto-body">
        {step.title && (
          <h4 id={titleId} className="eto-title">
            {step.title}
          </h4>
        )}
        {step.body && (
          <p id={bodyId} className="eto-copy">
            {step.body}
          </p>
        )}
      </div>
      <div className="eto-footer">
        <button
          type="button"
          className="eto-btn eto-btn-secondary"
          onClick={prev}
          disabled={isFirst}
        >
          Back
        </button>
        <button
          type="button"
          className="eto-btn eto-btn-primary"
          onClick={next}
          disabled={!canAdvance}
        >
          {isLast ? "Done" : "Next"}
        </button>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Branded body (alpha.1)
// ────────────────────────────────────────────────────────────────────────

/**
 * The new default-but-decent layout. Gradient header with logo slot,
 * body with title + copy, progress dots, accent-filled Next button.
 * Everything styled via the `.eto-card--branded` ruleset in styles.css
 * — this component only owns the DOM structure and the i18n of the
 * nav labels.
 */
function BrandedCardBody(props: {
  api: TutorialApi<unknown>;
  titleId: string;
  bodyId: string;
  logo?: string | React.ReactNode;
  logoAlt?: string;
  labels?: BrandedCardProps["labels"];
  hideProgress?: boolean;
}) {
  const { api, titleId, bodyId, logo, logoAlt, labels, hideProgress } = props;
  const { step, index, total, isFirst, isLast, canAdvance, next, prev, close } =
    api;
  if (!step) return null;

  const backLabel = labels?.back ?? "Back";
  const nextLabel = labels?.next ?? "Next";
  const doneLabel = labels?.done ?? "Done";
  const closeLabel = labels?.close ?? "Close tutorial";

  // Render the logo — string → <img>, React node → verbatim.
  const logoNode =
    typeof logo === "string" ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={logoAlt ?? ""}
        className="eto-branded-logo"
        draggable={false}
      />
    ) : (
      logo ?? null
    );

  // Dots render when total <= 15; numeric fallback keeps the row
  // legible on longer tours.
  const progressNode = (() => {
    if (hideProgress) return null;
    if (total <= 15) {
      return (
        <div className="eto-branded-progress" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={`eto-branded-dot${i === index ? " eto-active" : ""}`}
            />
          ))}
        </div>
      );
    }
    return (
      <div className="eto-branded-progress">
        <span className="eto-branded-progress-numeric">
          {index + 1} / {total}
        </span>
      </div>
    );
  })();

  return (
    <>
      <div className="eto-branded-header">
        {logoNode}
        <button
          type="button"
          className="eto-branded-close"
          onClick={close}
          aria-label={closeLabel}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </div>
      <div className="eto-branded-body">
        {step.title && (
          <h4 id={titleId} className="eto-branded-title">
            {step.title}
          </h4>
        )}
        {step.body && (
          <p id={bodyId} className="eto-branded-copy">
            {step.body}
          </p>
        )}
      </div>
      {progressNode}
      <div className="eto-branded-footer">
        <button
          type="button"
          className="eto-branded-btn eto-branded-btn-back"
          onClick={prev}
          disabled={isFirst}
        >
          {backLabel}
        </button>
        <button
          type="button"
          className="eto-branded-btn eto-branded-btn-next"
          onClick={next}
          disabled={!canAdvance}
        >
          {isLast ? doneLabel : nextLabel}
        </button>
      </div>
    </>
  );
}