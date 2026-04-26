"use client";

/**
 * @module overlay/Labels
 *
 * Alpha.16: text annotations with animated frame sequences.
 *
 * Each label can define an `animation` with multiple frames — the text
 * (and optionally variant/color) cycles through the frames on a timer.
 * Transitions are CSS-driven: "fade" crossfades, "slide-up" slides.
 *
 * Labels are draggable in editor mode and use absolute positioning
 * when `cardPositioning="absolute"`.
 */

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTutorial } from "../core/Tutorial";
import { OverlayPortal } from "../core/OverlayPortal";
import { useTargetRect } from "../core/useTargetRect";
import { useEditor } from "../editor/Editor";
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

  // When no target exists or hasn't registered yet, use the viewport
  // (or page) as the bounding rect so labels still render.
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

// ── Single label with animation support ─────────────────────────────────

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

  // ── Animation state ───────────────────────────────────────────────
  const anim = label.animation;
  const [frameIndex, setFrameIndex] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  // Reset animation on step/label change
  useEffect(() => {
    setFrameIndex(0);
    setTransitioning(false);
  }, [stepId, index]);

  // Frame timer
  useEffect(() => {
    if (!anim || anim.frames.length <= 1) return;

    const duration = anim.frameDuration ?? 2000;
    const delay = anim.delay ?? 0;
    const transition = anim.transition ?? "fade";
    const transitionMs = transition === "none" ? 0 : 300;

    let timer: ReturnType<typeof setTimeout>;

    const advance = () => {
      // Start transition out
      if (transition !== "none") {
        setTransitioning(true);
      }

      timer = setTimeout(() => {
        setFrameIndex((prev) => {
          const next = prev + 1;
          if (next >= anim.frames.length) {
            return anim.loop ? 0 : prev; // stay on last frame if not looping
          }
          return next;
        });
        setTransitioning(false);
      }, transitionMs);
    };

    // Initial delay, then cycle
    const startTimer = setTimeout(() => {
      const interval = setInterval(advance, duration);
      return () => clearInterval(interval);
    }, delay);

    // Also set up interval directly (startTimer returns cleanup)
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const delayTimer = setTimeout(() => {
      intervalId = setInterval(advance, duration);
    }, delay);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(delayTimer);
      clearTimeout(timer!);
      if (intervalId) clearInterval(intervalId);
    };
  }, [stepId, anim]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resolve current frame ─────────────────────────────────────────
  const currentFrame: TextLabelFrame | null =
    anim && anim.frames.length > 0 ? anim.frames[frameIndex] ?? null : null;

  // Merge frame overrides onto base label
  const displayText = currentFrame?.text ?? label.text;
  const displayVariant = currentFrame?.variant ?? label.variant ?? "callout";
  const displayColor = currentFrame?.color ?? label.color;
  const displayFontSize = currentFrame?.fontSize ?? label.fontSize ?? 12;

  // ── Position ──────────────────────────────────────────────────────
  const pos = targetPointToPx(label.position, targetRect);
  if (!pos) return null;

  const maxWidth = label.maxWidth ?? 200;
  const scrollX = isAbsolute ? window.scrollX : 0;
  const scrollY = isAbsolute ? window.scrollY : 0;

  // Transition class
  const transClass = anim?.transition ?? "fade";
  const animClass = transitioning ? ` eto-label--${transClass}-out` : (anim ? ` eto-label--${transClass}-in` : "");

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
    ...(dragging ? { cursor: "grabbing", opacity: 0.8 } : {}),
  };

  // ── Drag handler ──────────────────────────────────────────────────
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

  return (
    <div
      className={`eto-label eto-label--${displayVariant}${animClass}${isEditing ? " eto-label--editable" : ""}${dragging ? " eto-label--dragging" : ""}${hover && isEditing ? " eto-label--hover" : ""}`}
      style={style}
      key={`${stepId}-${index}-${frameIndex}`} // re-mount on frame change for animation
      onMouseDown={isEditing ? onMouseDown : undefined}
      onMouseEnter={isEditing ? () => setHover(true) : undefined}
      onMouseLeave={isEditing ? () => setHover(false) : undefined}
    >
      {displayText}
      {isEditing && <span className="eto-label-index">{index + 1}</span>}
    </div>
  );
}