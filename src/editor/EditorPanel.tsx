"use client";

/**
 * @module editor/EditorPanel
 *
 * A slide-out sidebar for authoring tutorials. Shows all steps in a
 * scrollable list, lets the author jump to any step, and provides
 * global settings (card position) plus Save / Revert controls.
 *
 * Mount inside `<Tutorial>` alongside `<EditorHandles>`. Renders
 * nothing when the editor is inactive.
 *
 *     <Tutorial ...>
 *       <Card>...</Card>
 *       <Arrow />
 *       <EditorHandles />
 *       <EditorPanel />
 *     </Tutorial>
 */

import * as React from "react";
import { useCallback, useState } from "react";
import { useTutorial } from "../core/Tutorial";
import { useEditor } from "./Editor";

// ── Icons ───────────────────────────────────────────────────────────────

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
);
const SpotIcon = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /></svg>
);
const CircleIcon = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3"><circle cx="12" cy="12" r="8" /></svg>
);

// ── Panel ───────────────────────────────────────────────────────────────

export interface EditorPanelProps {
  /** Which side to dock the panel. Default "right". */
  side?: "left" | "right";
  /** Initial collapsed state. Default false (open). */
  defaultCollapsed?: boolean;
}

export function EditorPanel(props: EditorPanelProps) {
  const { side = "right", defaultCollapsed = false } = props;
  const editor = useEditor();
  const api = useTutorial();

  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  if (!editor || !editor.active) return null;

  const { step: activeStep, index: activeIndex, total, goto } = api;
  const steps = editor.steps ?? [];
  const unsaved = editor.overrides
    ? Object.keys(editor.overrides.cardAnchors).length +
      Object.keys(editor.overrides.arrowTips).length +
      Object.keys(editor.overrides.circles).length +
      Object.keys(editor.overrides.newArrows).length
    : 0;

  const saving = editor.saveStatus === "saving";
  const saved = editor.saveStatus === "saved";

  return (
    <div
      className="eto-editor-panel"
      style={{ [side]: 0 }}
      data-collapsed={collapsed || undefined}
    >
      {/* ── Header ── */}
      <div className="eto-panel-header">
        <button
          type="button"
          className="eto-panel-toggle"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expand panel" : "Collapse panel"}
        >
          <ChevronIcon open={!collapsed} />
        </button>
        <span className="eto-panel-title">
          Tutorial Editor
        </span>
        <span className="eto-panel-count">
          {total} steps
        </span>
      </div>

      {!collapsed && (
        <>
          {/* ── Step list ── */}
          <div className="eto-panel-steps">
            {Array.from({ length: total }, (_, i) => {
              const s = steps[i] ?? { id: `step-${i}`, title: `Step ${i + 1}` };
              const isCurrent = i === activeIndex;
              const hasArrow = !!s.annotations?.arrow;
              const hasSpotlight = !!s.annotations?.spotlight;
              const hasCircles = (s.annotations?.circles?.length ?? 0) > 0;

              return (
                <button
                  key={s.id ?? i}
                  type="button"
                  className={`eto-panel-step${isCurrent ? " eto-panel-step--active" : ""}`}
                  onClick={() => goto(s.id)}
                  title={`Go to step "${s.id}"`}
                >
                  <span className="eto-panel-step-num">{i + 1}</span>
                  <span className="eto-panel-step-title">
                    {s.title || s.id || `Step ${i + 1}`}
                  </span>
                  <span className="eto-panel-step-badges">
                    {hasArrow && <span className="eto-panel-badge" title="Arrow"><ArrowIcon /></span>}
                    {hasSpotlight && <span className="eto-panel-badge" title="Spotlight"><SpotIcon /></span>}
                    {hasCircles && <span className="eto-panel-badge" title="Circles"><CircleIcon /></span>}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Current step info ── */}
          {activeStep && (
            <div className="eto-panel-info">
              <div className="eto-panel-info-label">Current step</div>
              <div className="eto-panel-info-row">
                <span className="eto-panel-info-key">id</span>
                <span className="eto-panel-info-val">{activeStep.id}</span>
              </div>
              {activeStep.selector && (
                <div className="eto-panel-info-row">
                  <span className="eto-panel-info-key">selector</span>
                  <span className="eto-panel-info-val">{activeStep.selector}</span>
                </div>
              )}
              {activeStep.targets && activeStep.targets.length > 0 && (
                <div className="eto-panel-info-row">
                  <span className="eto-panel-info-key">targets</span>
                  <span className="eto-panel-info-val">{activeStep.targets.join(", ")}</span>
                </div>
              )}
              {activeStep.cardAnchor && (
                <div className="eto-panel-info-row">
                  <span className="eto-panel-info-key">cardAnchor</span>
                  <span className="eto-panel-info-val">
                    {Math.round(activeStep.cardAnchor.x)}vw, {Math.round(activeStep.cardAnchor.y)}vh
                  </span>
                </div>
              )}
              {activeStep.annotations?.arrow && (
                <div className="eto-panel-info-row">
                  <span className="eto-panel-info-key">arrow tip</span>
                  <span className="eto-panel-info-val">
                    {Math.round(activeStep.annotations.arrow.to.x)}%, {Math.round(activeStep.annotations.arrow.to.y)}%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── Footer: Save / Revert ── */}
          <div className="eto-panel-footer">
            <button
              type="button"
              className={`eto-panel-btn eto-panel-btn--save${saved ? " eto-panel-btn--saved" : ""}`}
              onClick={() => editor.save()}
              disabled={unsaved === 0 || saving}
            >
              {saving ? "Saving…" : saved ? "✓ Saved" : `Save${unsaved > 0 ? ` (${unsaved})` : ""}`}
            </button>
            {unsaved > 0 && (
              <button
                type="button"
                className="eto-panel-btn"
                onClick={() => editor.revert()}
              >
                Revert
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}