"use client";

/**
 * @module overlay/Labels
 *
 * Alpha.15: text annotations on the target, positioned absolute (scroll
 * with the page). In editor mode, labels are directly draggable on the
 * canvas — drag to reposition, coordinates update live in the panel.
 */

import * as React from "react";
import { useCallback, useRef, useState } from "react";
import { useTutorial } from "../core/Tutorial";
import { OverlayPortal } from "../core/OverlayPortal";
import { useTargetRect } from "../core/useTargetRect";
import { useEditor } from "../editor/Editor";
import { pxToTargetPoint, targetPointToPx } from "../coords";
import type { Annotations, TextLabel } from "../types";

export function Labels() {
  const { step, cardPositioning } = useTutorial();
  const editor = useEditor();
  const targetId = step?.targets?.[0] ?? step?.selector ?? null;
  const targetRect = useTargetRect(targetId);

  const labels = step?.annotations?.labels;
  if (!step || !labels || labels.length === 0) return null;
  if (!targetRect || targetRect.width === 0) return null;

  const isAbsolute = cardPositioning === "absolute";
  const isEditing = !!editor?.active;

  return (
    <OverlayPortal>
      {labels.map((label, i) => (
        <LabelElement
          key={`${step.id}-${i}`}
          label={label}
          index={i}
          stepId={step.id}
          targetRect={targetRect}
          isAbsolute={isAbsolute}
          isEditing={isEditing}
          annotations={step.annotations ?? {}}
          allLabels={labels}
        />
      ))}
    </OverlayPortal>
  );
}

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

  const pos = targetPointToPx(label.position, targetRect);
  if (!pos) return null;

  const variant = label.variant ?? "callout";
  const fontSize = label.fontSize ?? 12;
  const maxWidth = label.maxWidth ?? 200;

  // Convert viewport px to page px for absolute mode
  const scrollX = isAbsolute ? window.scrollX : 0;
  const scrollY = isAbsolute ? window.scrollY : 0;

  const style: React.CSSProperties = {
    position: isAbsolute ? "absolute" : "fixed",
    left: pos.x + scrollX,
    top: pos.y + scrollY,
    transform: "translate(-50%, -100%)",
    maxWidth,
    fontSize,
    zIndex: 52,
    ...(label.color ? { color: label.color } : {}),
    ...(isEditing ? { pointerEvents: "auto", cursor: "grab" } : {}),
    ...(dragging ? { cursor: "grabbing", opacity: 0.8 } : {}),
  };

  // ── Drag handler (editor mode) ────────────────────────────────────
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

        // Update this label's position in the step
        const newLabels = [...allLabels];
        newLabels[index] = { ...newLabels[index], position: p };
        editor.updateStep(stepId, {
          annotations: { ...annotations, labels: newLabels },
        });
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
      className={`eto-label eto-label--${variant}${isEditing ? " eto-label--editable" : ""}${dragging ? " eto-label--dragging" : ""}${hover && isEditing ? " eto-label--hover" : ""}`}
      style={style}
      onMouseDown={isEditing ? onMouseDown : undefined}
      onMouseEnter={isEditing ? () => setHover(true) : undefined}
      onMouseLeave={isEditing ? () => setHover(false) : undefined}
    >
      {label.text}
      {isEditing && (
        <span className="eto-label-index">{index + 1}</span>
      )}
    </div>
  );
}