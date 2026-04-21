"use client";

/**
 * @module overlay/Circles
 *
 * Renders annotated ellipses on top of the current step's target.
 * Each ellipse is positioned in target-relative percentages; the
 * component re-projects them against the target's live rect so they
 * stay glued as the target moves.
 *
 * The target is the *first* id in `step.targets` that has a rect.
 * Multi-target spotlighting is supported for `<Spotlight>` but not
 * here — drawing multiple circle sets on multiple targets is rare
 * enough that consumers who need it can mount multiple `<Circles>`
 * each pointing at a different target (future extension).
 *
 * Renders nothing when:
 *   - the tour is closed,
 *   - the active step has no `annotations.circles`,
 *   - the target isn't yet registered / has zero area.
 */

import * as React from "react";
import { useTutorial } from "../core/Tutorial";
import { useTargetRect } from "../core/useTargetRect";
import type { Circle } from "../types";

export interface CirclesProps {
  /** Override the target. Defaults to the first id in `step.targets`. */
  target?: string;
  /** Stroke colour. Defaults to the CSS variable `--eto-accent`. */
  stroke?: string;
  /** Label colour. Defaults to the muted variant of accent. */
  labelColor?: string;
  /** Stroke width in SVG px. Default 2. */
  strokeWidth?: number;
  /** Dashed stroke pattern. Default false. */
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

  // Pick the target: explicit prop, else first target on the step.
  const targetId =
    targetOverride ?? step?.targets?.[0] ?? null;

  const rect = useTargetRect(targetId);
  const circles = step?.annotations?.circles;

  if (!step || !circles || circles.length === 0) return null;
  if (!rect || rect.width === 0 || rect.height === 0) return null;

  return (
    <svg
      className="eto-circles-svg"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
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
  );
}

// ────────────────────────────────────────────────────────────────────────

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

  // Centre and radii in page pixels.
  const cx = rect.left + rect.width * (c.x / 100);
  const cy = rect.top + rect.height * (c.y / 100);
  const rx = rect.width * (c.r / 100);
  const ry = rect.height * ((c.ry ?? c.r) / 100);
  const rot = c.rot ?? 0;

  return (
    <g transform={`rotate(${rot} ${cx} ${cy})`}>
      <ellipse
        cx={cx}
        cy={cy}
        rx={Math.max(rx, 0.5)}
        ry={Math.max(ry, 0.5)}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={dashed ? "4 3" : undefined}
        opacity={0.7}
      />
      {c.label && (
        <text
          x={cx}
          y={cy + ry + 14}
          textAnchor="middle"
          fill={labelColor}
          fontSize={11}
          fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
        >
          {c.label}
        </text>
      )}
    </g>
  );
}