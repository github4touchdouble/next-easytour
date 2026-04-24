"use client";

/**
 * @module overlay/Card
 *
 * Tutorial card. Alpha.3 adds:
 *   - `step.content` JSX body rendering
 *   - Entrance/exit CSS animation classes driven by `step.transition`
 *   - Waiting state indicator (pulsing Next button when waitFor is pending)
 *   - Smart card anchor for selector-targeted steps
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
import { OverlayPortal } from "../core/OverlayPortal";
import { useCardRectSetter } from "./Arrow";
import type { Rect } from "../core/useTargetRect";
import type { TutorialApi, CardVariant, BrandedCardProps, TransitionConfig } from "../types";

// ── Render-prop signature ───────────────────────────────────────────────

export interface CardRenderArgs<Meta = unknown> {
  step: NonNullable<TutorialApi<Meta>["step"]>;
  index: number;
  total: number;
  isFirst: boolean;
  isLast: boolean;
  canAdvance: boolean;
  isWaiting: boolean;
  next: () => void;
  prev: () => void;
  close: () => void;
}

type CardChildren<Meta = unknown> =
  | React.ReactNode
  | ((args: CardRenderArgs<Meta>) => React.ReactNode);

export interface CardProps<Meta = unknown> extends BrandedCardProps {
  children?: CardChildren<Meta>;
  variant?: CardVariant;
  disableKeyboard?: boolean;
  /** Override the global transition config. */
  transition?: TransitionConfig;
}

// ── Card component ──────────────────────────────────────────────────────

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
    transition: transitionProp,
  } = props;
  const api = useTutorial<Meta>();
  const {
    step, index, total, isFirst, isLast, canAdvance, isWaiting,
    next, prev, close, defaultCardAnchor,
  } = api;

  const baseId = useId();
  const titleId = `${baseId}-title`;
  const bodyId = `${baseId}-body`;

  // ── Card rect publication ─────────────────────────────────────────────
  // Publish the card's live bounding rect so <Arrow> and <EditorHandles>
  // can read it. Uses a rAF loop instead of ResizeObserver alone because
  // editor drags change the card's position without changing its size,
  // and ResizeObserver only fires on size changes.
  const cardRef = useRef<HTMLDivElement>(null);
  const setCardRect = useCardRectSetter();
  const lastRectRef = useRef<Rect | null>(null);
  const rafRef = useRef<number>(0);

  useLayoutEffect(() => {
    if (!cardRef.current) return;
    if (!setCardRect) return;
    const el = cardRef.current;

    const read = () => {
      const r = el.getBoundingClientRect();
      const next: Rect = { left: r.left, top: r.top, width: r.width, height: r.height };
      const prev = lastRectRef.current;
      if (
        prev &&
        Math.abs(prev.left - next.left) < 0.5 &&
        Math.abs(prev.top - next.top) < 0.5 &&
        Math.abs(prev.width - next.width) < 0.5 &&
        Math.abs(prev.height - next.height) < 0.5
      ) return;
      lastRectRef.current = next;
      setCardRect(next);
    };

    // RAF loop: re-reads the rect every frame so editor drag handles,
    // arrows, and any other rect consumer stay perfectly in sync.
    const tick = () => {
      read();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
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
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      switch (e.key) {
        case "Escape":
          e.preventDefault();
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

  // ── Resolve entrance animation class ──────────────────────────────────
  const enterAnim = step?.transition?.enter ?? transitionProp?.enter ?? "fade-slide";
  const animClass = enterAnim === "none" ? "" : ` eto-card--${enterAnim}`;

  // ── Positioning style ────────────────────────────────────────────────
  const positionStyle = useMemo<React.CSSProperties>(() => {
    // Priority: step.cardAnchor > defaultCardAnchor > computed default
    const anchor = step?.cardAnchor ?? defaultCardAnchor;
    if (anchor) {
      return {
        position: "fixed",
        left: `${anchor.x}vw`,
        top: `${anchor.y}vh`,
      };
    }
    const hasTargets = (step?.targets?.length ?? 0) > 0 || !!step?.selector;
    if (!hasTargets) {
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
  }, [step?.cardAnchor, step?.targets, step?.selector, defaultCardAnchor]);

  if (!step) return null;

  const renderArgs: CardRenderArgs<Meta> = {
    step, index, total, isFirst, isLast, canAdvance, isWaiting, next, prev, close,
  };
  const isRenderProp = typeof children === "function";
  const rendered = isRenderProp
    ? (children as (a: CardRenderArgs<Meta>) => React.ReactNode)(renderArgs)
    : null;

  const isBranded = variant === "branded" && !children;
  // When render-prop mode is active, the wrapper is just a positioning
  // container — the host's render-prop provides all visual styling.
  // .eto-card--custom strips border/shadow/bg from the wrapper.
  const className = [
    "eto-card",
    isRenderProp ? "eto-card--custom" : "",
    isBranded ? "eto-card--branded" : "",
    animClass,
  ].filter(Boolean).join(" ");

  const styleWithAccent: React.CSSProperties = {
    ...positionStyle,
    ...(accent ? ({ ["--eto-branded-accent" as string]: accent } as React.CSSProperties) : {}),
  };

  return (
    <OverlayPortal>
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
    </OverlayPortal>
  );
}

// ── Default body ────────────────────────────────────────────────────────

function DefaultCardBody(props: {
  api: TutorialApi<unknown>;
  titleId: string;
  bodyId: string;
}) {
  const { api, titleId, bodyId } = props;
  const { step, index, total, isFirst, isLast, canAdvance, isWaiting, next, prev, close } = api;
  if (!step) return null;

  return (
    <>
      <div className="eto-header">
        <span className="eto-progress">{index + 1} / {total}</span>
        <button type="button" className="eto-close" onClick={close} aria-label="Close tutorial">×</button>
      </div>
      <div className="eto-body">
        {step.title && <h4 id={titleId} className="eto-title">{step.title}</h4>}
        {step.content ? (
          <div id={bodyId} className="eto-copy">{step.content}</div>
        ) : step.body ? (
          <p id={bodyId} className="eto-copy">{step.body}</p>
        ) : null}
      </div>
      <div className="eto-footer">
        <button type="button" className="eto-btn eto-btn-secondary" onClick={prev} disabled={isFirst}>Back</button>
        <button
          type="button"
          className={`eto-btn eto-btn-primary${isWaiting ? " eto-waiting" : ""}`}
          onClick={next}
          disabled={!canAdvance}
        >
          {isWaiting ? "Waiting…" : isLast ? "Done" : "Next"}
        </button>
      </div>
    </>
  );
}

// ── Branded body ────────────────────────────────────────────────────────

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
  const { step, index, total, isFirst, isLast, canAdvance, isWaiting, next, prev, close } = api;
  if (!step) return null;

  const backLabel = labels?.back ?? "Back";
  const nextLabel = labels?.next ?? "Next";
  const doneLabel = labels?.done ?? "Done";
  const closeLabel = labels?.close ?? "Close tutorial";

  const logoNode =
    typeof logo === "string" ? (
      <img src={logo} alt={logoAlt ?? ""} className="eto-branded-logo" draggable={false} />
    ) : (logo ?? null);

  const progressNode = (() => {
    if (hideProgress) return null;
    if (total <= 15) {
      return (
        <div className="eto-branded-progress" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={`eto-branded-dot${i === index ? " eto-active" : ""}`} />
          ))}
        </div>
      );
    }
    return (
      <div className="eto-branded-progress">
        <span className="eto-branded-progress-numeric">{index + 1} / {total}</span>
      </div>
    );
  })();

  return (
    <>
      <div className="eto-branded-header">
        {logoNode}
        <button type="button" className="eto-branded-close" onClick={close} aria-label={closeLabel}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </div>
      <div className="eto-branded-body">
        {step.title && <h4 id={titleId} className="eto-branded-title">{step.title}</h4>}
        {step.content ? (
          <div id={bodyId} className="eto-branded-copy">{step.content}</div>
        ) : step.body ? (
          <p id={bodyId} className="eto-branded-copy">{step.body}</p>
        ) : null}
      </div>
      {progressNode}
      <div className="eto-branded-footer">
        <button type="button" className="eto-branded-btn eto-branded-btn-back" onClick={prev} disabled={isFirst}>{backLabel}</button>
        <button
          type="button"
          className={`eto-branded-btn eto-branded-btn-next${isWaiting ? " eto-waiting" : ""}`}
          onClick={next}
          disabled={!canAdvance}
        >
          {isWaiting ? "…" : isLast ? doneLabel : nextLabel}
        </button>
      </div>
    </>
  );
}