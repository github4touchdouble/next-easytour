"use client";

/**
 * @module editor/EditorHandles
 *
 * 0.3.0-alpha.3 redesign: replaces the three tiny handles with a
 * visible floating toolbar attached to the card. The toolbar provides:
 *
 *   - **Move** (drag) — reposition the card.
 *   - **Arrow** (drag from toolbar onto the target) — create or re-aim
 *     the arrow. Shows a live preview line while dragging.
 *   - **Spotlight toggle** — flip `annotations.spotlight` on/off.
 *   - **Save** button — persists overrides via the Editor's `onSave`.
 *   - **Revert** button — discards all unsaved overrides.
 *
 * Additionally, when an arrow exists, a visible tip handle renders on
 * the target so the author can re-aim by dragging it.
 *
 * Mounted inside `<Tutorial>` as a sibling of `<Card>` / `<Arrow>`.
 * Renders nothing when the editor is inactive.
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

// ── SVG icon paths (inline, no dependencies) ────────────────────────────

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

const SpotlightIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
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
  const { step } = useTutorial();
  const cardRect = useCardRect();
  const [draggingCard, setDraggingCard] = useState(false);
  const [draggingArrow, setDraggingArrow] = useState(false);
  const cardRectRef = useRef(cardRect);
  cardRectRef.current = cardRect;

  const targetId = step?.targets?.[0] ?? step?.selector ?? null;
  const targetRect = useTargetRect(targetId);
  const targetRectRef = useRef(targetRect);
  targetRectRef.current = targetRect;

  const hasArrow = !!step?.annotations?.arrow;
  const hasTarget = !!targetId;
  const hasSpotlight = !!step?.annotations?.spotlight;

  // ── Card drag ─────────────────────────────────────────────────────
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
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const raw = pxToViewportAnchor(
          { x: ev.clientX - offsetX, y: ev.clientY - offsetY },
          { width: vw, height: vh },
        );
        const cr = cardRectRef.current;
        const clamped = cr
          ? clampViewportAnchor(raw, { width: cr.width, height: cr.height }, { width: vw, height: vh })
          : raw;
        editor.setCardAnchor(step.id, clamped);
      };
      const onUp = () => {
        setDraggingCard(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [editor, step],
  );

  // ── Arrow drag-to-create / re-aim ─────────────────────────────────
  const onArrowDown = useCallback(
    (e: React.MouseEvent) => {
      if (!step || !hasTarget) return;
      e.preventDefault();
      e.stopPropagation();
      setDraggingArrow(true);

      // Dispatch a custom event so the preview line knows the start position
      window.dispatchEvent(
        new CustomEvent("eto-arrow-drag-start", {
          detail: { x: e.clientX, y: e.clientY },
        }),
      );

      // Seed the arrow if none exists
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
          new CustomEvent("eto-arrow-drag-move", {
            detail: { x: ev.clientX, y: ev.clientY },
          }),
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

  // ── Spotlight toggle ──────────────────────────────────────────────
  // The editor doesn't have a setSpotlight mutator — we approximate
  // by dispatching a custom event the host can listen for, or we
  // could add it. For now this is a visual indicator only.
  // TODO: Add setSpotlight to EditorInternalApi.

  // ── Save ──────────────────────────────────────────────────────────
  const onSave = useCallback(() => { editor.save(); }, [editor]);
  const onRevert = useCallback(() => { editor.revert(); }, [editor]);
  const onResetPosition = useCallback(() => {
    if (step) editor.clearCardAnchor(step.id);
  }, [editor, step]);

  if (!cardRect || !step) return null;

  const unsaved = editor.overrides
    ? Object.keys(editor.overrides.cardAnchors).length +
      Object.keys(editor.overrides.arrowTips).length +
      Object.keys(editor.overrides.circles).length +
      Object.keys(editor.overrides.newArrows).length
    : 0;

  const saving = editor.saveStatus === "saving";
  const saved = editor.saveStatus === "saved";

  // Position toolbar ABOVE the card. If card is near the top of
  // the viewport (<44px), flip below instead.
  const toolbarLeft = cardRect.left;
  const above = cardRect.top - 40;
  const below = cardRect.top + cardRect.height + 6;
  const toolbarTop = above >= 4 ? above : below;

  return (
    <div
      className="eto-editor-toolbar"
      style={{
        position: "fixed",
        left: toolbarLeft,
        top: toolbarTop,
        zIndex: 61,
      }}
    >
      {/* Move handle */}
      <button
        type="button"
        className={`eto-editor-tool${draggingCard ? " eto-tool-active" : ""}`}
        onMouseDown={onMoveDown}
        onDoubleClick={onResetPosition}
        title="Drag to move card. Double-click to reset."
      >
        <MoveIcon />
        <span className="eto-tool-label">Move</span>
      </button>

      {/* Arrow handle */}
      <button
        type="button"
        className={`eto-editor-tool${draggingArrow ? " eto-tool-active" : ""}${!hasTarget ? " eto-tool-disabled" : ""}`}
        onMouseDown={hasTarget ? onArrowDown : undefined}
        title={hasTarget
          ? (hasArrow ? "Drag to re-aim arrow" : "Drag onto the target to create an arrow")
          : "No target on this step"}
      >
        <ArrowIcon />
        <span className="eto-tool-label">{hasArrow ? "Aim" : "Arrow"}</span>
      </button>

      {/* Spotlight indicator */}
      <div
        className={`eto-editor-tool eto-tool-indicator${hasSpotlight ? " eto-tool-on" : ""}`}
        title={hasSpotlight ? "Spotlight: ON" : "Spotlight: OFF (set in JSON)"}
      >
        <SpotlightIcon />
      </div>

      {/* Divider */}
      <div className="eto-tool-divider" />

      {/* Save */}
      <button
        type="button"
        className={`eto-editor-tool eto-tool-save${unsaved > 0 ? " eto-tool-has-changes" : ""}${saved ? " eto-tool-saved" : ""}`}
        onClick={onSave}
        disabled={unsaved === 0 || saving}
        title={unsaved > 0 ? `Save ${unsaved} change${unsaved > 1 ? "s" : ""}` : "No unsaved changes"}
      >
        <SaveIcon />
        <span className="eto-tool-label">
          {saving ? "…" : saved ? "✓" : "Save"}
        </span>
        {unsaved > 0 && (
          <span className="eto-tool-badge">{unsaved}</span>
        )}
      </button>

      {/* Revert */}
      {unsaved > 0 && (
        <button
          type="button"
          className="eto-editor-tool"
          onClick={onRevert}
          title="Discard all unsaved changes"
        >
          <UndoIcon />
        </button>
      )}
    </div>
  );
}

// ── Arrow tip handle ────────────────────────────────────────────────────

/**
 * Visible handle at the arrow tip. Larger and more prominent than the
 * alpha.1 version — rendered as a pulsing accent-colored dot.
 */
function ArrowTipHandle() {
  const editor = useEditor()!;
  const { step } = useTutorial();
  const [dragging, setDragging] = useState(false);

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
    <div
      role="button"
      aria-label="Drag to move the arrow tip"
      className={`eto-editor-tip-handle${dragging ? " eto-dragging" : ""}`}
      style={{
        position: "fixed",
        left: tip.x - 10,
        top: tip.y - 10,
      }}
      onMouseDown={onMouseDown}
      title="Drag to re-aim the arrow"
    />
  );
}

// ── Arrow drag preview line ─────────────────────────────────────────────

/**
 * While the author is dragging from the Arrow button to place an arrow,
 * this draws a thin dashed line from the card to the cursor so they can
 * see where the arrow will point before releasing.
 */
function ArrowDragPreview() {
  const cardRect = useCardRect();
  const [line, setLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  useEffect(() => {
    const onStart = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (cardRect) {
        setLine({
          x1: cardRect.left + cardRect.width / 2,
          y1: cardRect.top + cardRect.height / 2,
          x2: d.x,
          y2: d.y,
        });
      }
    };
    const onMove = (e: Event) => {
      const d = (e as CustomEvent).detail;
      setLine((prev) =>
        prev ? { ...prev, x2: d.x, y2: d.y } : null,
      );
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
    <svg
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 62,
      }}
      aria-hidden="true"
    >
      <line
        x1={line.x1}
        y1={line.y1}
        x2={line.x2}
        y2={line.y2}
        stroke="var(--eto-accent)"
        strokeWidth="2"
        strokeDasharray="6 4"
        opacity="0.6"
      />
      <circle
        cx={line.x2}
        cy={line.y2}
        r="6"
        fill="var(--eto-accent)"
        opacity="0.4"
      />
    </svg>
  );
}