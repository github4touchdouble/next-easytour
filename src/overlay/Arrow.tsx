"use client";

/**
 * @module overlay/Arrow
 *
 * Bézier arrow from card to target. Alpha.3 adds a draw-on animation
 * via SVG stroke-dashoffset — the arrow appears to draw itself from
 * the card toward the target over ~400ms.
 */

import * as React from "react";
import { createContext, useContext, useRef, useEffect, useState } from "react";
import { useTutorial } from "../core/Tutorial";
import { OverlayPortal } from "../core/OverlayPortal";
import { useTargetRect } from "../core/useTargetRect";
import {
  buildPath,
  cardContainsPoint,
  nearestCardEdge,
  resolveStyle,
} from "../geometry";
import { targetPointToPx } from "../coords";
import type { Rect } from "../core/useTargetRect";

// ── Card rect context ───────────────────────────────────────────────────

interface CardRectStore {
  rect: Rect | null;
  setRect: (r: Rect | null) => void;
}

export const CardRectContext = createContext<CardRectStore | null>(null);

export function useCardRect(): Rect | null {
  const store = useContext(CardRectContext);
  return store ? store.rect : null;
}

export function useCardRectSetter(): ((r: Rect | null) => void) | null {
  const store = useContext(CardRectContext);
  return store ? store.setRect : null;
}

// ── Arrow ───────────────────────────────────────────────────────────────

export interface ArrowProps {
  color?: string;
  opacity?: number;
  hideWhenOverlapping?: boolean;
  /** Disable the draw-on animation. Default false. */
  disableAnimation?: boolean;
}

export function Arrow(props: ArrowProps) {
  const {
    color = "var(--eto-arrow)",
    opacity,
    hideWhenOverlapping = true,
    disableAnimation = false,
  } = props;

  const { step } = useTutorial();
  const cardRect = useCardRect();

  const arrow = step?.annotations?.arrow;
  // Resolve target: hook-registered ID first, then `step.selector`
  const targetId = step?.targets?.[0] ?? step?.selector ?? null;
  const targetRect = useTargetRect(targetId);

  // Animation state: track path length for stroke-dashoffset animation
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);
  const [animated, setAnimated] = useState(false);
  const prevStepId = useRef<string | null>(null);

  useEffect(() => {
    if (step?.id !== prevStepId.current) {
      prevStepId.current = step?.id ?? null;
      setAnimated(false);
      // Trigger animation after a frame
      requestAnimationFrame(() => setAnimated(true));
    }
  }, [step?.id]);

  useEffect(() => {
    if (pathRef.current) {
      try {
        setPathLength(pathRef.current.getTotalLength());
      } catch {
        setPathLength(500); // fallback
      }
    }
  });

  if (!step || !arrow) return null;
  if (!cardRect) return null;
  if (!targetRect) return null;
  if (targetRect.width === 0 && targetRect.height === 0) return null;

  const tip = targetPointToPx(arrow.to, targetRect);
  if (!tip) return null;

  if (hideWhenOverlapping && cardContainsPoint(cardRect, tip)) return null;

  const src = nearestCardEdge(cardRect, tip);
  const style = resolveStyle(arrow.style);
  const d = buildPath(src, tip, style);

  const markerId = `eto-arrow-head-${step.id}`;
  const shouldAnimate = !disableAnimation && (arrow.style?.animated !== false) && animated;
  const dashStyle: React.CSSProperties | undefined = shouldAnimate && pathLength > 0
    ? {
        strokeDasharray: pathLength,
        strokeDashoffset: 0,
        animation: `eto-arrow-draw 400ms ease-out`,
      }
    : undefined;

  return (
    <OverlayPortal>
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
            <circle cx="5" cy="5" r="3" fill="none" stroke={color} strokeWidth="1.5" />
          ) : (
            <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
          )}
        </marker>
      </defs>
      <path
        ref={pathRef}
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={style.strokeWidth}
        strokeLinecap="round"
        strokeDasharray={style.dashed ? "6 4" : dashStyle?.strokeDasharray?.toString()}
        strokeDashoffset={dashStyle?.strokeDashoffset}
        style={!style.dashed ? dashStyle : undefined}
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
    </OverlayPortal>
  );
}