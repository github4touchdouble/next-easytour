"use client";

/**
 * @module overlay/Tooltip
 *
 * Lightweight annotation component. Renders a small popover near the
 * target element with the step's title and/or body. Unlike `<Card>`,
 * Tooltip has no navigation controls — it's for steps that auto-advance
 * or are part of a sequence where navigation is handled elsewhere.
 *
 * Position is computed relative to the target element (top/bottom/left/right).
 */

import * as React from "react";
import { useMemo } from "react";
import { useTutorial } from "../core/Tutorial";
import { useTargetRect } from "../core/useTargetRect";
import type { Rect } from "../core/useTargetRect";

export interface TooltipProps {
  /**
   * Preferred placement relative to target. Flips automatically if
   * the tooltip would overflow the viewport. Default "top".
   */
  placement?: "top" | "bottom" | "left" | "right";
  /** Offset from the target edge in pixels. Default 8. */
  offset?: number;
  /** Maximum width in pixels. Default 280. */
  maxWidth?: number;
  /** Show a close button. Default false. */
  showClose?: boolean;
  /** Custom class on the tooltip wrapper. */
  className?: string;
}

export function Tooltip(props: TooltipProps) {
  const {
    placement = "top",
    offset = 8,
    maxWidth = 280,
    showClose = false,
    className,
  } = props;

  const { step, close } = useTutorial();
  const targetId = step?.targets?.[0] ?? step?.selector ?? null;
  const targetRect = useTargetRect(targetId);

  const style = useMemo<React.CSSProperties | null>(() => {
    if (!targetRect) return null;
    const r = targetRect;
    const base: React.CSSProperties = {
      position: "fixed",
      maxWidth,
      zIndex: "var(--eto-card-z)" as unknown as number,
    };

    switch (placement) {
      case "top":
        return { ...base, left: r.left + r.width / 2, top: r.top - offset, transform: "translate(-50%, -100%)" };
      case "bottom":
        return { ...base, left: r.left + r.width / 2, top: r.top + r.height + offset, transform: "translateX(-50%)" };
      case "left":
        return { ...base, left: r.left - offset, top: r.top + r.height / 2, transform: "translate(-100%, -50%)" };
      case "right":
        return { ...base, left: r.left + r.width + offset, top: r.top + r.height / 2, transform: "translateY(-50%)" };
    }
  }, [targetRect, placement, offset, maxWidth]);

  if (!step) return null;
  if (!step.title && !step.body && !step.content) return null;
  if (!style) return null;

  return (
    <div
      className={`eto-tooltip${className ? ` ${className}` : ""}`}
      style={style}
      role="tooltip"
    >
      {step.title && <div className="eto-tooltip-title">{step.title}</div>}
      {step.content ? (
        <div className="eto-tooltip-body">{step.content}</div>
      ) : step.body ? (
        <div className="eto-tooltip-body">{step.body}</div>
      ) : null}
      {showClose && (
        <button type="button" className="eto-tooltip-close" onClick={close} aria-label="Close">
          ×
        </button>
      )}
    </div>
  );
}