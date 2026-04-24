"use client";

/**
 * @module overlay/Spotlight
 *
 * Dims the viewport except for cutouts around the target(s). Alpha.3
 * adds smooth CSS transitions on the cutout rects so the spotlight
 * morphs between targets instead of jumping, and supports selector-
 * based targeting.
 */

import * as React from "react";
import { useEffect, useState } from "react";
import { useTutorial } from "../core/Tutorial";
import { OverlayPortal } from "../core/OverlayPortal";
import { useTargetRect } from "../core/useTargetRect";
import type { Rect } from "../core/useTargetRect";

export interface SpotlightProps {
  color?: string;
  opacity?: number;
  cornerRadius?: number;
  padding?: number;
  blockClicks?: boolean;
  /** Animate cutout transitions between steps. Default true. */
  animate?: boolean;
}

export function Spotlight(props: SpotlightProps) {
  const {
    color = "rgba(0, 0, 0, 1)",
    opacity = 0.45,
    cornerRadius = 6,
    padding = 6,
    blockClicks = false,
    animate = true,
  } = props;

  const { step } = useTutorial();

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

  // Resolve targets: hook IDs first, then step.selector
  const targets = step?.targets ?? [];
  const selectorId = step?.selector ?? null;

  // Use up to 4 target rects
  const rect0 = useTargetRect(targets[0] ?? selectorId ?? null);
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
  const transitionStyle = animate ? "x 300ms ease, y 300ms ease, width 300ms ease, height 300ms ease" : undefined;

  return (
    <OverlayPortal>
    <svg
      className="eto-spotlight-svg"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ pointerEvents: blockClicks ? "auto" : "none" }}
    >
      <defs>
        <mask id={maskId}>
          <rect x="0" y="0" width={vp.width} height={vp.height} fill="white" />
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
              style={transitionStyle ? { transition: transitionStyle } : undefined}
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
        style={{ transition: "opacity 300ms ease" }}
      />
    </svg>
    </OverlayPortal>
  );
}