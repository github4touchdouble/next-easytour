"use client";

/**
 * @module overlay/Circles
 *
 * Annotated ellipses on the target. Updated in alpha.3 to support
 * selector-based targeting (falls back to step.selector when no
 * hook-registered target exists).
 */

import * as React from "react";
import { useTutorial } from "../core/Tutorial";
import { OverlayPortal } from "../core/OverlayPortal";
import { useTargetRect } from "../core/useTargetRect";
import type { Circle } from "../types";

export interface CirclesProps {
  target?: string;
  stroke?: string;
  labelColor?: string;
  strokeWidth?: number;
  dashed?: boolean;
}

export function Circles(props: CirclesProps) {
  const {
    target: targetOverride,
    stroke = "var(--eto-accent)",
    labelColor = "var(--eto-muted)",
    strokeWidth = 2,
    dashed = false,
  } = props;

  const { step } = useTutorial();
  const targetId = targetOverride ?? step?.targets?.[0] ?? step?.selector ?? null;
  const rect = useTargetRect(targetId);
  const circles = step?.annotations?.circles;

  if (!step || !circles || circles.length === 0) return null;
  if (!rect || rect.width === 0 || rect.height === 0) return null;

  return (
    <OverlayPortal>
    <svg className="eto-circles-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {circles.map((c, i) => (
        <CircleAnnotation
          key={i}
          circle={c}
          rect={rect}
          stroke={stroke}
          labelColor={labelColor}
          strokeWidth={strokeWidth}
          dashed={dashed}
        />
      ))}
    </svg>
    </OverlayPortal>
  );
}

interface CircleAnnotationProps {
  circle: Circle;
  rect: { left: number; top: number; width: number; height: number };
  stroke: string;
  labelColor: string;
  strokeWidth: number;
  dashed: boolean;
}

function CircleAnnotation(props: CircleAnnotationProps) {
  const { circle: c, rect, stroke, labelColor, strokeWidth, dashed } = props;
  const cx = rect.left + rect.width * (c.x / 100);
  const cy = rect.top + rect.height * (c.y / 100);
  const rx = rect.width * (c.r / 100);
  const ry = rect.height * ((c.ry ?? c.r) / 100);
  const rot = c.rot ?? 0;

  return (
    <g transform={`rotate(${rot} ${cx} ${cy})`}>
      <ellipse
        cx={cx} cy={cy}
        rx={Math.max(rx, 0.5)} ry={Math.max(ry, 0.5)}
        fill="none" stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={dashed ? "4 3" : undefined}
        opacity={0.7}
      />
      {c.label && (
        <text x={cx} y={cy + ry + 14} textAnchor="middle" fill={labelColor} fontSize={11} fontFamily="-apple-system, BlinkMacSystemFont, sans-serif">
          {c.label}
        </text>
      )}
    </g>
  );
}