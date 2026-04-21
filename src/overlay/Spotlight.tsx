"use client";

/**
 * @module overlay/Spotlight
 *
 * Dims the entire viewport except for rectangular cutouts around the
 * active step's target(s). Implemented as a full-screen fixed SVG
 * with a mask: the mask's white rect exposes the dimming layer; the
 * black rects punch holes where the targets live.
 *
 * Design choices:
 *
 *   - **SVG mask, not multiple `<div>` overlays.** A four-div border
 *     arrangement breaks as soon as two targets overlap or the
 *     target has rounded corners. A mask handles arbitrary cutout
 *     geometry with a single layer.
 *
 *   - **`pointer-events: none` by default.** The overlay is
 *     cosmetic; it must not block clicks on the targets or anywhere
 *     else. Hosts that want to trap clicks outside the target to
 *     force tour progression can set `blockClicks`.
 *
 *   - **Renders nothing when the step has no targets or
 *     `annotations.spotlight !== true`.** Opt-in per step.
 */

import * as React from "react";
import { useEffect, useState } from "react";
import { useTutorial } from "../core/Tutorial";
import { useTargetRect } from "../core/useTargetRect";
import type { Rect } from "../core/useTargetRect";

export interface SpotlightProps {
  /** Dim colour. Defaults to black at low opacity. */
  color?: string;
  /** Dim opacity (0–1). Default 0.45. */
  opacity?: number;
  /** Rounded-corner radius on the cutout, in pixels. Default 6. */
  cornerRadius?: number;
  /**
   * Padding around the target inside the cutout, in pixels. Gives
   * the target a bit of breathing room rather than clipping it flush.
   * Default 6.
   */
  padding?: number;
  /** Block pointer events outside the target. Default false. */
  blockClicks?: boolean;
}

export function Spotlight(props: SpotlightProps) {
  const {
    color = "rgba(0, 0, 0, 1)",
    opacity = 0.45,
    cornerRadius = 6,
    padding = 6,
    blockClicks = false,
  } = props;

  const { step } = useTutorial();

  // Track viewport size for the backdrop rect.
  const [vp, setVp] = useState<{ width: number; height: number }>(() =>
    typeof window === "undefined"
      ? { width: 0, height: 0 }
      : { width: window.innerWidth, height: window.innerHeight },
  );
  useEffect(() => {
    const onResize = () =>
      setVp({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Collect rects for every target on the step. Hooks must be called
  // unconditionally — so we don't loop over steps.targets with hooks.
  // Instead we support up to four targets per step (pragmatic limit;
  // real tours never spotlight more than 2–3 things simultaneously).
  const targets = step?.targets ?? [];
  const rect0 = useTargetRect(targets[0] ?? null);
  const rect1 = useTargetRect(targets[1] ?? null);
  const rect2 = useTargetRect(targets[2] ?? null);
  const rect3 = useTargetRect(targets[3] ?? null);
  const rects = [rect0, rect1, rect2, rect3].filter(
    (r): r is Rect => r !== null && r.width > 0 && r.height > 0,
  );

  if (!step) return null;
  if (!step.annotations?.spotlight) return null;
  if (rects.length === 0) return null;

  const maskId = `eto-spotlight-mask-${step.id}`;

  return (
    <svg
      className="eto-spotlight-svg"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{
        pointerEvents: blockClicks ? "auto" : "none",
      }}
    >
      <defs>
        <mask id={maskId}>
          {/* White = visible backdrop. Full viewport. */}
          <rect x="0" y="0" width={vp.width} height={vp.height} fill="white" />
          {/* Black = cutouts. Each target gets a rounded rect. */}
          {rects.map((r, i) => (
            <rect
              key={i}
              x={r.left - padding}
              y={r.top - padding}
              width={r.width + padding * 2}
              height={r.height + padding * 2}
              rx={cornerRadius}
              ry={cornerRadius}
              fill="black"
            />
          ))}
        </mask>
      </defs>
      <rect
        x="0"
        y="0"
        width={vp.width}
        height={vp.height}
        fill={color}
        opacity={opacity}
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}