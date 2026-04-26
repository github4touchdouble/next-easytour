"use client";

/**
 * @module overlay/Labels
 *
 * Renders text annotations (callouts, badges, tags, code, plain) placed
 * relative to the target element. Each label is positioned using the
 * same coordinate system as arrow tips (percentage of target rect).
 */

import * as React from "react";
import { useTutorial } from "../core/Tutorial";
import { OverlayPortal } from "../core/OverlayPortal";
import { useTargetRect } from "../core/useTargetRect";
import { targetPointToPx } from "../coords";
import type { TextLabel } from "../types";

export function Labels() {
  const { step } = useTutorial();
  const targetId = step?.targets?.[0] ?? step?.selector ?? null;
  const targetRect = useTargetRect(targetId);

  const labels = step?.annotations?.labels;
  if (!step || !labels || labels.length === 0) return null;
  if (!targetRect || targetRect.width === 0) return null;

  return (
    <OverlayPortal>
      {labels.map((label, i) => (
        <LabelElement key={i} label={label} targetRect={targetRect} />
      ))}
    </OverlayPortal>
  );
}

function LabelElement({ label, targetRect }: {
  label: TextLabel;
  targetRect: { left: number; top: number; width: number; height: number };
}) {
  const pos = targetPointToPx(label.position, targetRect);
  if (!pos) return null;

  const variant = label.variant ?? "callout";
  const fontSize = label.fontSize ?? 12;
  const maxWidth = label.maxWidth ?? 200;

  const style: React.CSSProperties = {
    position: "fixed",
    left: pos.x,
    top: pos.y,
    transform: "translate(-50%, -100%)",
    maxWidth,
    fontSize,
    zIndex: 52,
    ...(label.color ? { color: label.color } : {}),
  };

  return (
    <div className={`eto-label eto-label--${variant}`} style={style}>
      {label.text}
    </div>
  );
}