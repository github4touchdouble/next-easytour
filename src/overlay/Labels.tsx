"use client";

/**
 * @module overlay/Labels
 *
 * Alpha.17: uses the animation engine's `useFrameSequence` for text
 * cycling. No DOM remounting, no flicker. CSS classes drive transitions.
 */

import * as React from "react";
import { useCallback, useRef, useState } from "react";
import { useTutorial } from "../core/Tutorial";
import { OverlayPortal } from "../core/OverlayPortal";
import { useTargetRect } from "../core/useTargetRect";
import { useEditor } from "../editor/Editor";
import { useFrameSequence, useEnterAnimation } from "../core/animation";
import { pxToTargetPoint, targetPointToPx } from "../coords";
import type { Annotations, TextLabel, TextLabelFrame } from "../types";

export function Labels() {
  const { step, cardPositioning } = useTutorial();
  const editor = useEditor();
  const targetId = step?.targets?.[0] ?? step?.selector ?? null;
  const targetRect = useTargetRect(targetId);

  const labels = step?.annotations?.labels;
  if (!step || !labels || labels.length === 0) return null;

  const isAbsolute = cardPositioning === "absolute";
  const isEditing = !!editor?.active;

  const fallbackRect = typeof window !== "undefined"
    ? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
    : { left: 0, top: 0, width: 1000, height: 800 };
  const effectiveRect = (targetRect && targetRect.width > 0) ? targetRect : fallbackRect;

  return (
    <OverlayPortal>
      {labels.map((label, i) => (
        <LabelElement
          key={`${step.id}-${i}`}
          label={label}
          index={i}
          stepId={step.id}
          targetRect={effectiveRect}
          isAbsolute={isAbsolute}
          isEditing={isEditing}
          annotations={step.annotations ?? {}}
          allLabels={labels}
        />
      ))}
    </OverlayPortal>
  );
}

// ── Single label ────────────────────────────────────────────────────────

function LabelElement({ label, index, stepId, targetRect, isAbsolute, isEditing, annotations, allLabels }: {
  label: TextLabel;
  index: number;
  stepId: string;
  targetRect: { left: number; top: number; width: number; height: number };
  isAbsolute: boolean;
  isEditing: boolean;
  annotations: Annotations;
  allLabels: TextLabel[];
}) {
  const editor = useEditor();
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState(false);
  const targetRectRef = useRef(targetRect);
  targetRectRef.current = targetRect;

  // ── Animation via the engine ──────────────────────────────────────
  const anim = label.animation;
  const frames = anim?.frames ?? [];
  const hasAnimation = frames.length > 1;

  // Build the frames array — if no animation, single frame from label props
  const effectiveFrames: TextLabelFrame[] = hasAnimation
    ? frames
    : [{ text: label.text, variant: label.variant, color: label.color, fontSize: label.fontSize }];

  const { current: frame, phase } = useFrameSequence(effectiveFrames, {
    frameDuration: anim?.frameDuration ?? 2000,
    transitionDuration: 300,
    loop: anim?.loop ?? false,
    delay: anim?.delay ?? 0,
    enabled: hasAnimation,
  });

  // Enter animation for the label itself (on step change)
  const enterClass = useEnterAnimation(stepId, "eto-label--enter", 300);

  // ── Resolve display values ────────────────────────────────────────
  const displayText = frame.text ?? label.text;
  const displayVariant = frame.variant ?? label.variant ?? "callout";
  const displayColor = frame.color ?? label.color;
  const displayFontSize = frame.fontSize ?? label.fontSize ?? 12;

  // ── Position ──────────────────────────────────────────────────────
  const pos = targetPointToPx(label.position, targetRect);
  if (!pos) return null;

  const maxWidth = label.maxWidth ?? 200;
  const scrollX = isAbsolute ? window.scrollX : 0;
  const scrollY = isAbsolute ? window.scrollY : 0;

  // Phase → CSS class (delay phase hides the label)
  const phaseClass = hasAnimation
    ? phase === "delay" ? " eto-anim--hidden"
      : phase === "exiting" ? " eto-anim--exit"
      : phase === "entering" ? " eto-anim--enter"
      : ""
    : "";

  const style: React.CSSProperties = {
    position: isAbsolute ? "absolute" : "fixed",
    left: pos.x + scrollX,
    top: pos.y + scrollY,
    transform: "translate(-50%, -100%)",
    maxWidth,
    fontSize: displayFontSize,
    zIndex: 52,
    ...(displayColor ? { color: displayColor } : {}),
    ...(isEditing ? { pointerEvents: "auto", cursor: "grab" } : {}),
    ...(dragging ? { cursor: "grabbing" } : {}),
  };

  // ── Drag ──────────────────────────────────────────────────────────
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isEditing || !editor) return;
      e.preventDefault();
      e.stopPropagation();
      setDragging(true);

      const onMove = (ev: MouseEvent) => {
        const rect = targetRectRef.current;
        if (!rect) return;
        const p = pxToTargetPoint(
          { x: ev.clientX, y: ev.clientY },
          { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        );
        if (!p) return;
        const newLabels = [...allLabels];
        newLabels[index] = { ...newLabels[index], position: p };
        editor.updateStep(stepId, { annotations: { ...annotations, labels: newLabels } });
      };
      const onUp = () => {
        setDragging(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [isEditing, editor, index, stepId, annotations, allLabels],
  );

  const className = [
    "eto-label",
    `eto-label--${displayVariant}`,
    enterClass,
    phaseClass,
    isEditing ? "eto-label--editable" : "",
    dragging ? "eto-label--dragging" : "",
    hover && isEditing ? "eto-label--hover" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={className}
      style={style}
      onMouseDown={isEditing ? onMouseDown : undefined}
      onMouseEnter={isEditing ? () => setHover(true) : undefined}
      onMouseLeave={isEditing ? () => setHover(false) : undefined}
    >
      {displayText}
      {isEditing && <span className="eto-label-index">{index + 1}</span>}
    </div>
  );
}