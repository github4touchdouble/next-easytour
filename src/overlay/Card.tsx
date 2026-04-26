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
  useState,
} from "react";
import { useTutorial } from "../core/Tutorial";
import { OverlayPortal } from "../core/OverlayPortal";
import { useEnterAnimation } from "../core/animation";
import { useCardRectSetter } from "./Arrow";
import type { Rect } from "../core/useTargetRect";
import type { TutorialApi, TransitionConfig } from "../types";

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

export interface CardProps<Meta = unknown> {
  children?: CardChildren<Meta>;
  disableKeyboard?: boolean;
  /** Override the global transition config. */
  transition?: TransitionConfig;
}

// ── Card component ──────────────────────────────────────────────────────

export function Card<Meta = unknown>(props: CardProps<Meta>) {
  const {
    children,
    disableKeyboard = false,
    transition: transitionProp,
  } = props;
  const api = useTutorial<Meta>();
  const {
    step, index, total, isFirst, isLast, canAdvance, isWaiting,
    next, prev, close, defaultCardAnchor, cardPositioning,
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

  // ── Stable card sizing ────────────────────────────────────────────────
  // Track the maximum height the card reaches across all steps.
  // Apply as minHeight so the card never shrinks → no visual jump.
  const maxHeightRef = useRef<number>(0);
  const [stableMinHeight, setStableMinHeight] = useState<number>(0);

  useLayoutEffect(() => {
    if (!cardRef.current) return;
    if (!setCardRect) return;
    const el = cardRef.current;

    const read = () => {
      const r = el.getBoundingClientRect();
      const next: Rect = { left: r.left, top: r.top, width: r.width, height: r.height };

      // Grow-only: update stable height when content is taller
      if (r.height > maxHeightRef.current + 0.5) {
        maxHeightRef.current = r.height;
        setStableMinHeight(r.height);
      }

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
  const enterAnimType = step?.transition?.enter ?? transitionProp?.enter ?? "fade";
  const animClass = useEnterAnimation(
    step?.id ?? null,
    enterAnimType === "none" ? "" : `eto-card--${enterAnimType}`,
    step?.transition?.duration ?? transitionProp?.duration ?? 250,
  );

  // ── Positioning style ────────────────────────────────────────────────
  const isAbsolute = cardPositioning === "absolute";
  const positionStyle = useMemo<React.CSSProperties>(() => {
    const pos = isAbsolute ? "absolute" : "fixed";
    // Priority: step.cardAnchor > defaultCardAnchor > computed default
    const anchor = step?.cardAnchor ?? defaultCardAnchor;
    if (anchor) {
      if (isAbsolute) {
        // x/y are page pixels
        return { position: pos, left: `${anchor.x}px`, top: `${anchor.y}px` };
      }
      // x/y are viewport percentages
      return { position: pos, left: `${anchor.x}vw`, top: `${anchor.y}vh` };
    }
    const hasTargets = (step?.targets?.length ?? 0) > 0 || !!step?.selector;
    if (!hasTargets) {
      return {
        position: pos,
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      };
    }
    return {
      position: pos,
      left: "50%",
      bottom: "1.5rem",
      transform: "translateX(-50%)",
    };
  }, [step?.cardAnchor, step?.targets, step?.selector, defaultCardAnchor, isAbsolute]);

  if (!step) return null;

  const renderArgs: CardRenderArgs<Meta> = {
    step, index, total, isFirst, isLast, canAdvance, isWaiting, next, prev, close,
  };
  const isRenderProp = typeof children === "function";
  const rendered = isRenderProp
    ? (children as (a: CardRenderArgs<Meta>) => React.ReactNode)(renderArgs)
    : null;

  // When render-prop mode is active, the wrapper is just a positioning
  // container — the host's render-prop provides all visual styling.
  // .eto-card--custom strips border/shadow/bg from the wrapper.
  const className = [
    "eto-card",
    isRenderProp ? "eto-card--custom" : "",
    animClass,
  ].filter(Boolean).join(" ");

  const styleObj: React.CSSProperties = {
    ...positionStyle,
    ...(stableMinHeight > 0 ? { minHeight: stableMinHeight } : {}),
  };

  return (
    <OverlayPortal>
    <div
      ref={cardRef}
      className={className}
      style={styleObj}
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

// (BrandedCardBody removed in alpha.19 — hosts use render-prop for custom card styling)