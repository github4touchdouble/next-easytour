"use client";

/**
 * @module editor/EditorHandles
 *
 * Mounts drag handles for the authoring editor:
 *
 *   1. **Card handle** — floating grip overlay anchored to the
 *      card's current top-left. Dragging it updates the current
 *      step's `cardAnchor` override via the Editor context.
 *
 *   2. **Arrow-tip handle** — a small dot over the arrow tip, dragged
 *      to re-aim the arrow. Writes a `TargetPoint` override to the
 *      current step.
 *
 * Mounted inside `<Tutorial>` as a sibling of `<Card>` / `<Arrow>`.
 * Renders nothing when the editor is inactive (`canEdit === false`).
 * Both handles are pointer-events-enabled rectangles overlaid on
 * positioned SVG; they don't interfere with the targets themselves.
 *
 *     <Tutorial {...}>
 *       <Spotlight />
 *       <Arrow />
 *       <Card />
 *       <EditorHandles />    ← opt-in
 *     </Tutorial>
 */

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTutorial } from "../core/Tutorial";
import { useTargetRect } from "../core/useTargetRect";
import { useCardRect } from "../overlay/Arrow";
import { useEditor } from "./Editor";
import {
  clampViewportAnchor,
  pxToTargetPoint,
  pxToViewportAnchor,
  targetPointToPx,
} from "../coords";

export function EditorHandles() {
  const editor = useEditor();
  const { step } = useTutorial();

  // Renders nothing when not active or when there's no step.
  if (!editor || !editor.active || !step) return null;

  return (
    <>
      <CardHandle />
      <ArrowTipHandle />
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Card handle
// ────────────────────────────────────────────────────────────────────────

/**
 * Fixed-position grip anchored to the card's top-left. Drag writes
 * a `ViewportAnchor` override; double-click clears the override,
 * reverting to the step's saved anchor (or the default if none).
 */
function CardHandle() {
  const editor = useEditor()!;
  const { step } = useTutorial();
  const cardRect = useCardRect();
  const [dragging, setDragging] = useState(false);

  // Keep a ref to the card rect so the drag handlers read the latest
  // value without re-binding on every frame.
  const cardRectRef = useRef(cardRect);
  cardRectRef.current = cardRect;

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!step) return;
      const rect = cardRectRef.current;
      if (!rect) return;
      e.preventDefault();
      e.stopPropagation();
      setDragging(true);

      // Pointer offset from card top-left so the handle stays under
      // the cursor as the card moves.
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;

      const onMove = (ev: MouseEvent) => {
        const nextLeftPx = ev.clientX - offsetX;
        const nextTopPx = ev.clientY - offsetY;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const raw = pxToViewportAnchor(
          { x: nextLeftPx, y: nextTopPx },
          { width: vw, height: vh },
        );
        const currentRect = cardRectRef.current;
        const clamped = currentRect
          ? clampViewportAnchor(
              raw,
              { width: currentRect.width, height: currentRect.height },
              { width: vw, height: vh },
            )
          : raw;
        editor.setCardAnchor(step.id, clamped);
      };
      const onUp = () => {
        setDragging(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [editor, step],
  );

  const onDoubleClick = useCallback(() => {
    if (!step) return;
    editor.clearCardAnchor(step.id);
  }, [editor, step]);

  if (!cardRect) return null;

  return (
    <div
      role="button"
      aria-label="Drag to reposition tutorial card; double-click to reset"
      className={`eto-editor-card-handle${dragging ? " eto-dragging" : ""}`}
      style={{
        position: "fixed",
        left: cardRect.left - 4,
        top: cardRect.top - 4,
        width: 24,
        height: 24,
      }}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      title="Drag to reposition. Double-click to reset."
    />
  );
}

// ────────────────────────────────────────────────────────────────────────
// Arrow-tip handle
// ────────────────────────────────────────────────────────────────────────

/**
 * Small fixed-position dot at the arrow's tip. Dragging moves the tip
 * relative to the target element — the new point is stored as a
 * `TargetPoint` override.
 *
 * Renders nothing when the current step has no arrow or no primary
 * target registered.
 */
function ArrowTipHandle() {
  const editor = useEditor()!;
  const { step } = useTutorial();
  const [dragging, setDragging] = useState(false);

  const arrow = step?.annotations?.arrow;
  const targetId = step?.targets?.[0] ?? null;
  const targetRect = useTargetRect(targetId);

  // Keep target rect in a ref so drag handlers see the latest without
  // re-binding.
  const targetRectRef = useRef(targetRect);
  targetRectRef.current = targetRect;

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!step || !arrow || !targetRectRef.current) return;
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
        if (p) editor.setArrowTip(step.id, p);
      };
      const onUp = () => {
        setDragging(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [editor, step, arrow],
  );

  if (!step || !arrow || !targetRect) return null;
  if (targetRect.width === 0 || targetRect.height === 0) return null;

  const tip = targetPointToPx(arrow.to, targetRect);
  if (!tip) return null;

  return (
    <div
      role="button"
      aria-label="Drag to move the arrow tip"
      className={`eto-editor-tip-handle${dragging ? " eto-dragging" : ""}`}
      style={{
        position: "fixed",
        left: tip.x - 8,
        top: tip.y - 8,
        width: 16,
        height: 16,
      }}
      onMouseDown={onMouseDown}
      title="Drag to move the arrow tip"
    />
  );
}