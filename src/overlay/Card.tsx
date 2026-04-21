"use client";

/**
 * @module overlay/Card
 *
 * The tutorial card. Two modes:
 *
 *   1. **Default** — renders a title + body + progress + nav card
 *      ready to use. No branding.
 *
 *          <Card />
 *
 *   2. **Render-prop** — full control over the card's internal
 *      markup. Receives the full tutorial API as an argument.
 *
 *          <Card>
 *            {({ step, index, total, next, prev, close }) => (
 *              <MyBrandedCard step={step} onNext={next} ... />
 *            )}
 *          </Card>
 *
 * In both modes the outer `<div className="eto-card">` wrapper is
 * the library's. It handles:
 *
 *   - Positioning (from `step.cardAnchor` or the default).
 *   - Fixed layout so the card stays anchored during scroll.
 *   - Publishing its live `DOMRect` to `CardRectContext` so
 *     `<Arrow>` can route its origin to the nearest card edge.
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
  useState,
} from "react";
import { useTutorial } from "../core/Tutorial";
import { CardRectContext } from "./Arrow";
import type { Rect } from "../core/useTargetRect";
import type { TutorialApi } from "../types";

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

export interface CardProps<Meta = unknown> {
  /**
   * Render-prop children receive the tutorial API as an argument and
   * return fully custom JSX. A plain React node renders alongside the
   * library's default header/body/footer.
   *
   * Omit `children` entirely to use the fully-default card.
   */
  children?: CardChildren<Meta>;
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
  const { children, disableKeyboard = false } = props;
  const api = useTutorial<Meta>();
  const { step, index, total, isFirst, isLast, canAdvance, next, prev, close } =
    api;

  // Unique ids for aria-labelledby / aria-describedby on the default
  // card layout.
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const bodyId = `${baseId}-body`;

  // ── Card rect publication ─────────────────────────────────────────────
  //
  // Observe the card's own bounding rect so the Arrow can route to the
  // nearest edge midpoint. ResizeObserver + scroll + window resize so
  // the published rect tracks every case. Published via context, not
  // state lifted to the Provider, because only <Arrow> consumes it.
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardRect, setCardRect] = useState<Rect | null>(null);

  useLayoutEffect(() => {
    if (!cardRef.current) return;
    const el = cardRef.current;

    const read = () => {
      const r = el.getBoundingClientRect();
      const next: Rect = {
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      };
      setCardRect((prev) => {
        if (
          prev &&
          Math.abs(prev.left - next.left) < 0.5 &&
          Math.abs(prev.top - next.top) < 0.5 &&
          Math.abs(prev.width - next.width) < 0.5 &&
          Math.abs(prev.height - next.height) < 0.5
        ) {
          return prev;
        }
        return next;
      });
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
    };
  }, [step?.id]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  //
  // Bound to `window` with capture so the shortcuts work regardless of
  // which descendant has focus. Easy to disable for hosts where arrow
  // keys already mean something in the surrounding UI.
  useEffect(() => {
    if (disableKeyboard) return;
    if (!step) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      // Ignore shortcut events while the user is typing in an input.
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
  // `step.cardAnchor === undefined` → default bottom-centre.
  // Otherwise → literal top-left anchor in viewport %.
  //
  // `position: fixed` lives here, not in CSS, so hosts can opt into
  // `position: absolute` wrappers if they really want the card to
  // flow inline (niche; setting it up is their problem).
  const positionStyle = useMemo<React.CSSProperties>(() => {
    if (!step?.cardAnchor) {
      return {
        position: "fixed",
        left: "50%",
        bottom: "1.5rem",
        transform: "translateX(-50%)",
      };
    }
    return {
      position: "fixed",
      left: `${step.cardAnchor.x}vw`,
      top: `${step.cardAnchor.y}vh`,
    };
  }, [step?.cardAnchor]);

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

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <CardRectContext.Provider value={cardRect}>
      <div
        ref={cardRef}
        className="eto-card"
        style={positionStyle}
        role="dialog"
        aria-modal="false"
        aria-labelledby={!isRenderProp ? titleId : undefined}
        aria-describedby={!isRenderProp ? bodyId : undefined}
      >
        {isRenderProp ? (
          rendered
        ) : children ? (
          children
        ) : (
          <DefaultCardBody
            api={api as TutorialApi<unknown>}
            titleId={titleId}
            bodyId={bodyId}
          />
        )}
      </div>
    </CardRectContext.Provider>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Default body
// ────────────────────────────────────────────────────────────────────────

/**
 * The library-supplied default layout. Rendered when `<Card>` has no
 * children. Kept as a separate component so its class names are
 * isolated from any user-supplied children and can be styled
 * independently via `styles.css`.
 *
 * No branding. If you want a logo, use render-prop mode.
 */
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