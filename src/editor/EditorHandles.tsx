"use client";

/**
 * @module editor/EditorHandles
 *
 * Alpha.10: fixes first-card toolbar not appearing (deferred cardRect),
 * cleaner drag logic, "Move all" for global position.
 */

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTutorial } from "../core/Tutorial";
import { useTargetRect } from "../core/useTargetRect";
import { useCardRect } from "../overlay/Arrow";
import { useEditor } from "./Editor";
import { OverlayPortal } from "../core/OverlayPortal";
import {
  clampViewportAnchor,
  pxToTargetPoint,
  pxToViewportAnchor,
  targetPoint,
  targetPointToPx,
} from "../coords";

// ── Icons ───────────────────────────────────────────────────────────────

const MoveIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="5 9 2 12 5 15" /><polyline points="9 5 12 2 15 5" />
    <polyline points="15 19 12 22 9 19" /><polyline points="19 9 22 12 19 15" />
    <line x1="2" y1="12" x2="22" y2="12" /><line x1="12" y1="2" x2="12" y2="22" />
  </svg>
);
const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);
const SaveIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
  </svg>
);
const UndoIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
);

// ── Main export ─────────────────────────────────────────────────────────

export function EditorHandles() {
  const editor = useEditor();
  const { step } = useTutorial();

  if (!editor || !editor.active || !step) return null;

  return (
    <OverlayPortal>
    <>
      <EditorToolbar />
      {step.annotations?.arrow && <ArrowTipHandle />}
      <ArrowDragPreview />
    </>
    </OverlayPortal>
  );
}

// ── Toolbar ─────────────────────────────────────────────────────────────

function EditorToolbar() {
  const editor = useEditor()!;
  const { step, cardPositioning } = useTutorial();
  const cardRect = useCardRect();
  const [draggingCard, setDraggingCard] = useState(false);
  const [draggingArrow, setDraggingArrow] = useState(false);
  const cardRectRef = useRef(cardRect);
  cardRectRef.current = cardRect;

  const isAbsolute = cardPositioning === "absolute";

  const targetId = step?.targets?.[0] ?? step?.selector ?? null;
  const targetRect = useTargetRect(targetId);
  const targetRectRef = useRef(targetRect);
  targetRectRef.current = targetRect;

  const hasArrow = !!step?.annotations?.arrow;
  const hasTarget = !!targetId;

  // ── Wait for cardRect on first render ─────────────────────────────
  // FIX alpha.10: cardRect may be null on the very first step because
  // the Card hasn't published its rect yet. Instead of returning null
  // (which hides the toolbar entirely), we poll until it appears.
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (cardRect) return;
    const id = setInterval(() => forceUpdate((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [cardRect, step?.id]);

  // ── Card drag — sets position for ALL steps ───────────────────────
  // Sets both per-step anchor (immediate visual feedback during drag)
  // and global defaultCardAnchor (applied to all steps on save).
  const onMoveDown = useCallback(
    (e: React.MouseEvent) => {
      if (!step) return;
      const rect = cardRectRef.current;
      if (!rect) return;
      e.preventDefault();
      e.stopPropagation();
      setDraggingCard(true);

      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;

      const onMove = (ev: MouseEvent) => {
        let anchor: { space: "viewport"; x: number; y: number };
        if (isAbsolute) {
          const pageX = ev.clientX - offsetX + window.scrollX;
          const pageY = ev.clientY - offsetY + window.scrollY;
          anchor = { space: "viewport", x: pageX, y: pageY };
        } else {
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const raw = pxToViewportAnchor(
            { x: ev.clientX - offsetX, y: ev.clientY - offsetY },
            { width: vw, height: vh },
          );
          const cr = cardRectRef.current;
          anchor = cr
            ? clampViewportAnchor(raw, { width: cr.width, height: cr.height }, { width: vw, height: vh })
            : raw;
        }
        // Per-step for immediate feedback + global for all steps
        editor.setCardAnchor(step.id, anchor);
        editor.setDefaultCardAnchor(anchor);
      };
      const onUp = () => {
        setDraggingCard(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [editor, step, isAbsolute],
  );

  // ── Arrow drag ────────────────────────────────────────────────────
  const onArrowDown = useCallback(
    (e: React.MouseEvent) => {
      if (!step || !hasTarget) return;
      e.preventDefault();
      e.stopPropagation();
      setDraggingArrow(true);

      window.dispatchEvent(
        new CustomEvent("eto-arrow-drag-start", {
          detail: { x: e.clientX, y: e.clientY },
        }),
      );

      if (!hasArrow) {
        editor.setArrow(step.id, { to: targetPoint(50, 50) });
      }

      const onMove = (ev: MouseEvent) => {
        const rect = targetRectRef.current;
        if (!rect) return;
        const p = pxToTargetPoint(
          { x: ev.clientX, y: ev.clientY },
          { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        );
        if (p) editor.setArrowTip(step.id, p);
        window.dispatchEvent(
          new CustomEvent("eto-arrow-drag-move", { detail: { x: ev.clientX, y: ev.clientY } }),
        );
      };
      const onUp = () => {
        setDraggingArrow(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        window.dispatchEvent(new CustomEvent("eto-arrow-drag-end"));
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [editor, step, hasArrow, hasTarget],
  );

  const onSave = useCallback(() => { editor.save(); }, [editor]);
  const onRevert = useCallback(() => { editor.revert(); }, [editor]);

  if (!step) return null;

  // Don't block render if cardRect is null — just hide position-dependent parts
  const unsaved = unsavedCountFromOverrides(editor.overrides);
  const saving = editor.saveStatus === "saving";
  const saved = editor.saveStatus === "saved";

  // Compute toolbar position — wait for cardRect, don't render at wrong position
  if (!cardRect) return null;

  const scrollX = isAbsolute ? window.scrollX : 0;
  const scrollY = isAbsolute ? window.scrollY : 0;
  const toolbarStyle: React.CSSProperties = {
    position: isAbsolute ? "absolute" : "fixed",
    left: cardRect.left + scrollX,
    top: (cardRect.top - 40 >= 4)
      ? cardRect.top - 40 + scrollY
      : cardRect.top + cardRect.height + 6 + scrollY,
    zIndex: 61,
  };

  return (
    <div className="eto-editor-toolbar" style={toolbarStyle}>
      <button type="button"
        className={`eto-editor-tool${draggingCard ? " eto-tool-active" : ""}`}
        onMouseDown={onMoveDown}
        title="Drag to move card (all steps)">
        <MoveIcon />
        <span className="eto-tool-label">Move all</span>
      </button>

      <button type="button"
        className={`eto-editor-tool${draggingArrow ? " eto-tool-active" : ""}${!hasTarget ? " eto-tool-disabled" : ""}`}
        onMouseDown={hasTarget ? onArrowDown : undefined}
        title={hasTarget ? (hasArrow ? "Drag to re-aim arrow" : "Drag onto target to create arrow") : "No target on this step"}>
        <ArrowIcon />
        <span className="eto-tool-label">{hasArrow ? "Aim" : "Arrow"}</span>
      </button>

      <div className="eto-tool-divider" />

      <button type="button"
        className={`eto-editor-tool eto-tool-save${unsaved > 0 ? " eto-tool-has-changes" : ""}${saved ? " eto-tool-saved" : ""}`}
        onClick={onSave} disabled={unsaved === 0 || saving}
        title={unsaved > 0 ? `Save ${unsaved} change${unsaved > 1 ? "s" : ""}` : "No unsaved changes"}>
        <SaveIcon />
        <span className="eto-tool-label">{saving ? "…" : saved ? "✓" : "Save"}</span>
        {unsaved > 0 && <span className="eto-tool-badge">{unsaved}</span>}
      </button>

      {unsaved > 0 && (
        <button type="button" className="eto-editor-tool" onClick={onRevert} title="Discard all unsaved changes">
          <UndoIcon />
        </button>
      )}
    </div>
  );
}

// ── Arrow tip handle ────────────────────────────────────────────────────

function ArrowTipHandle() {
  const editor = useEditor()!;
  const { step, cardPositioning } = useTutorial();
  const [dragging, setDragging] = useState(false);
  const isAbsolute = cardPositioning === "absolute";

  const arrow = step?.annotations?.arrow;
  const targetId = step?.targets?.[0] ?? step?.selector ?? null;
  const targetRect = useTargetRect(targetId);
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
    <div role="button" aria-label="Drag to move the arrow tip"
      className={`eto-editor-tip-handle${dragging ? " eto-dragging" : ""}`}
      style={{
        position: isAbsolute ? "absolute" : "fixed",
        left: tip.x - 10 + (isAbsolute ? window.scrollX : 0),
        top: tip.y - 10 + (isAbsolute ? window.scrollY : 0),
      }}
      onMouseDown={onMouseDown}
      title="Drag to re-aim the arrow"
    />
  );
}

// ── Arrow drag preview ──────────────────────────────────────────────────

function ArrowDragPreview() {
  const cardRect = useCardRect();
  const [line, setLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  useEffect(() => {
    const onStart = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (cardRect) {
        setLine({ x1: cardRect.left + cardRect.width / 2, y1: cardRect.top + cardRect.height / 2, x2: d.x, y2: d.y });
      }
    };
    const onMove = (e: Event) => {
      const d = (e as CustomEvent).detail;
      setLine((prev) => prev ? { ...prev, x2: d.x, y2: d.y } : null);
    };
    const onEnd = () => setLine(null);
    window.addEventListener("eto-arrow-drag-start", onStart);
    window.addEventListener("eto-arrow-drag-move", onMove);
    window.addEventListener("eto-arrow-drag-end", onEnd);
    return () => {
      window.removeEventListener("eto-arrow-drag-start", onStart);
      window.removeEventListener("eto-arrow-drag-move", onMove);
      window.removeEventListener("eto-arrow-drag-end", onEnd);
    };
  }, [cardRect]);

  if (!line) return null;
  return (
    <svg style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 62 }} aria-hidden="true">
      <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="var(--eto-accent)" strokeWidth="2" strokeDasharray="6 4" opacity="0.6" />
      <circle cx={line.x2} cy={line.y2} r="6" fill="var(--eto-accent)" opacity="0.4" />
    </svg>
  );
}

function unsavedCountFromOverrides(o: any): number {
  if (!o) return 0;
  return (
    Object.keys(o.cardAnchors ?? {}).length +
    Object.keys(o.arrowTips ?? {}).length +
    Object.keys(o.circles ?? {}).length +
    Object.keys(o.newArrows ?? {}).length +
    Object.keys(o.stepEdits ?? {}).length +
    (o.addedSteps?.length ?? 0) +
    (o.removedIds?.length ?? 0) +
    (o.defaultCardAnchor ? 1 : 0)
  );
}