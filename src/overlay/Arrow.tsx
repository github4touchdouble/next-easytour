"use client";

/**
 * @module overlay/Arrow
 *
 * Draws a single Bézier arrow from the tutorial card to the active
 * step's primary target point. Re-routes as the card moves, the
 * target moves, or the viewport resizes.
 *
 * The arrow's card-side origin follows the card's nearest edge to
 * the target, not a fixed top-centre. See `geometry.nearestCardEdge`.
 *
 * The card publishes its live rect through `CardRectContext`
 * (populated by `<Card>` via a ResizeObserver). The arrow consumes
 * that rect plus `useTargetRect` to compute its path.
 *
 * Renders nothing when:
 *   - the tour is closed,
 *   - the active step has no `annotations.arrow`,
 *   - the card hasn't yet published a rect (first-paint race),
 *   - the target is not yet registered.
 */

import * as React from "react";
import { createContext, useContext } from "react";
import { useTutorial } from "../core/Tutorial";
import { useTargetRect } from "../core/useTargetRect";
import {
  buildPath,
  cardContainsPoint,
  nearestCardEdge,
  resolveStyle,
} from "../geometry";
import { targetPointToPx } from "../coords";
import type { Rect } from "../core/useTargetRect";

// ────────────────────────────────────────────────────────────────────────
// Card rect context
// ────────────────────────────────────────────────────────────────────────

/**
 * Store for the card's current bounding rect. The Provider is mounted
 * by `<Tutorial>` — not by `<Card>` — because readers like
 * `<EditorHandles>` are siblings of `<Card>` in the composed JSX tree
 * and therefore cannot consume a context scoped to Card's own subtree.
 *
 * Card writes its rect via `setRect` on mount / resize / scroll; any
 * descendant of `<Tutorial>` (Arrow, EditorHandles, custom overlays)
 * reads it via `useCardRect()`.
 *
 * Shape change in 0.3.0-alpha.1-fix: the context value is now
 * `{ rect, setRect }` instead of a bare `Rect | null`. `useCardRect()`
 * still returns `Rect | null` so existing callers don't need to
 * update; the setter is consumed only by Card internally via
 * `useCardRectSetter()`.
 */
interface CardRectStore {
  rect: Rect | null;
  setRect: (r: Rect | null) => void;
}

/** @internal — Provider mounted by `<Tutorial>`, not by `<Card>`. */
export const CardRectContext = createContext<CardRectStore | null>(null);

/** Hook consumed by `<Arrow>`, `<EditorHandles>`, and any host code
 *  that wants to know where the card currently sits. Returns `null`
 *  when the tour is closed or the card has not yet measured itself. */
export function useCardRect(): Rect | null {
  const store = useContext(CardRectContext);
  return store ? store.rect : null;
}

/** @internal — Used by `<Card>` to publish its rect on each tick. */
export function useCardRectSetter(): ((r: Rect | null) => void) | null {
  const store = useContext(CardRectContext);
  return store ? store.setRect : null;
}

// ────────────────────────────────────────────────────────────────────────
// Arrow
// ────────────────────────────────────────────────────────────────────────

export interface ArrowProps {
  /** Stroke colour. Defaults to CSS variable `--eto-arrow`. */
  color?: string;
  /** Opacity override. Defaults to CSS variable `--eto-arrow-opacity`. */
  opacity?: number;
  /**
   * Hide the arrow when the card physically contains the target
   * point (zero-length arrow). Default true.
   */
  hideWhenOverlapping?: boolean;
}

export function Arrow(props: ArrowProps) {
  const {
    color = "var(--eto-arrow)",
    opacity,
    hideWhenOverlapping = true,
  } = props;

  const { step } = useTutorial();
  const cardRect = useCardRect();

  const arrow = step?.annotations?.arrow;
  const targetId = step?.targets?.[0] ?? null;
  const targetRect = useTargetRect(targetId);

  // Guards — render nothing while we lack the data needed to route
  // the arrow. Order matters; each guard depends only on what came
  // before it, so the branch is stable across renders.
  if (!step || !arrow) return null;
  if (!cardRect) return null;
  if (!targetRect) return null;
  if (targetRect.width === 0 && targetRect.height === 0) return null;

  // Arrow tip in page pixels.
  const tip = targetPointToPx(arrow.to, targetRect);
  if (!tip) return null;

  // Suppress when card is on top of the target — a zero-length arrow
  // would render as a degenerate path or a tiny dot.
  if (hideWhenOverlapping && cardContainsPoint(cardRect, tip)) return null;

  // Arrow origin = nearest edge midpoint of the card.
  const src = nearestCardEdge(cardRect, tip);

  // Resolve style with defaults.
  const style = resolveStyle(arrow.style);
  const d = buildPath(src, tip, style);

  // Unique marker id scoped to the step so two mounted Arrows don't
  // collide (e.g. remounting across steps during fades).
  const markerId = `eto-arrow-head-${step.id}`;

  return (
    <svg
      className="eto-arrow-svg"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX={style.loopEnd ? 5 : 9}
          refY="5"
          markerWidth={style.headSize}
          markerHeight={style.headSize}
          orient="auto-start-reverse"
        >
          {style.loopEnd ? (
            <circle
              cx="5"
              cy="5"
              r="3"
              fill="none"
              stroke={color}
              strokeWidth="1.5"
            />
          ) : (
            <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
          )}
        </marker>
      </defs>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={style.strokeWidth}
        strokeLinecap="round"
        strokeDasharray={style.dashed ? "6 4" : undefined}
        opacity={opacity}
        markerEnd={`url(#${markerId})`}
      />
      {arrow.label && (
        <text
          x={tip.x}
          y={tip.y + 14}
          textAnchor="middle"
          fill="var(--eto-muted)"
          fontSize={11}
          fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
        >
          {arrow.label}
        </text>
      )}
    </svg>
  );
}