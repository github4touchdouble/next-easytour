"use client";

/**
 * @module editor/EditorPanel
 *
 * Alpha.7: Full PowerPoint-style tutorial editor panel. Each step is
 * expandable with inline editing for all properties. Supports add,
 * remove, reorder, and live preview.
 */

import * as React from "react";
import { useCallback, useRef, useState } from "react";
import { useTutorial } from "../core/Tutorial";
import { useEditor } from "./Editor";
import { OverlayPortal } from "../core/OverlayPortal";
import { targetPoint } from "../coords";
import type { Step } from "../types";

// ── Icons (inline SVG, no deps) ─────────────────────────────────────────

const ChevronDown = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms", flexShrink: 0 }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
    <path d="M9 6V4h6v2" />
  </svg>
);
const UpIcon = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);
const DownIcon = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const CopyIcon = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

// ── Main export ─────────────────────────────────────────────────────────

export interface EditorPanelProps {
  side?: "left" | "right";
  defaultCollapsed?: boolean;
}

export function EditorPanel(props: EditorPanelProps) {
  const { side = "right", defaultCollapsed = false } = props;
  const editor = useEditor();
  const api = useTutorial();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  if (!editor || !editor.active) return null;

  const { step: activeStep, goto } = api;
  const steps = editor.steps;
  const unsaved = unsavedCountOf(editor.overrides);
  const saving = editor.saveStatus === "saving";
  const saved = editor.saveStatus === "saved";

  const toggleExpand = (id: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const onAddStep = () => {
    const id = `step-${Date.now()}`;
    editor.addStep({
      id,
      title: "New step",
      body: "",
    });
    setExpandedSteps((prev) => new Set(prev).add(id));
    // Navigate to it after a tick so the step exists in the list
    setTimeout(() => goto(id), 50);
  };

  return (
    <OverlayPortal>
    <div
      className="eto-editor-panel"
      style={{ [side]: 0 }}
      data-collapsed={collapsed || undefined}
    >
      {/* Header */}
      <div className="eto-panel-header">
        <button type="button" className="eto-panel-toggle"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expand" : "Collapse"}>
          <ChevronDown open={!collapsed} />
        </button>
        {!collapsed && (
          <>
            <span className="eto-panel-title">Tutorial Editor</span>
            <span className="eto-panel-count">{steps.length} steps</span>
          </>
        )}
      </div>

      {!collapsed && (
        <>
          {/* Step list */}
          <div className="eto-panel-steps">
            {steps.map((s, i) => (
              <StepCard
                key={s.id}
                step={s}
                index={i}
                total={steps.length}
                isActive={activeStep?.id === s.id}
                isExpanded={expandedSteps.has(s.id)}
                onToggle={() => toggleExpand(s.id)}
                onSelect={() => goto(s.id)}
                editor={editor}
              />
            ))}
          </div>

          {/* Add step button */}
          <button type="button" className="eto-panel-add" onClick={onAddStep}>
            <PlusIcon /> Add step
          </button>

          {/* Footer */}
          <div className="eto-panel-footer">
            <button type="button"
              className={`eto-panel-btn eto-panel-btn--save${saved ? " eto-panel-btn--saved" : ""}`}
              onClick={() => editor.save()}
              disabled={unsaved === 0 || saving}>
              {saving ? "Saving…" : saved ? "✓ Saved" : `Save${unsaved > 0 ? ` (${unsaved})` : ""}`}
            </button>
            {unsaved > 0 && (
              <button type="button" className="eto-panel-btn" onClick={() => editor.revert()}>
                Revert
              </button>
            )}
          </div>
        </>
      )}
    </div>
    </OverlayPortal>
  );
}

// ── Single step card ────────────────────────────────────────────────────

function StepCard({ step, index, total, isActive, isExpanded, onToggle, onSelect, editor }: {
  step: Step<unknown>;
  index: number;
  total: number;
  isActive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
  editor: ReturnType<typeof useEditor> & {};
}) {
  const hasArrow = !!step.annotations?.arrow;
  const hasSpotlight = !!step.annotations?.spotlight;

  return (
    <div className={`eto-panel-step${isActive ? " eto-panel-step--active" : ""}`}>
      {/* Step header row */}
      <div className="eto-panel-step-header">
        <button type="button" className="eto-panel-step-expand" onClick={onToggle}>
          <ChevronDown open={isExpanded} />
        </button>
        <button type="button" className="eto-panel-step-select" onClick={onSelect}>
          <span className="eto-panel-step-num">{index + 1}</span>
          <span className="eto-panel-step-title">{step.title || step.id}</span>
        </button>
        {/* Badges */}
        <span className="eto-panel-step-badges">
          {hasArrow && <span className="eto-panel-badge" title="Arrow">→</span>}
          {hasSpotlight && <span className="eto-panel-badge" title="Spotlight">◎</span>}
        </span>
      </div>

      {/* Expanded editor */}
      {isExpanded && (
        <StepEditor step={step} index={index} total={total} editor={editor} />
      )}
    </div>
  );
}

// ── Step editor (expanded) ──────────────────────────────────────────────

function StepEditor({ step, index, total, editor }: {
  step: Step<unknown>;
  index: number;
  total: number;
  editor: ReturnType<typeof useEditor> & {};
}) {
  const update = useCallback(
    (patch: Partial<Step<unknown>>) => editor.updateStep(step.id, patch),
    [editor, step.id],
  );

  const hasArrow = !!step.annotations?.arrow;
  const hasSpotlight = !!step.annotations?.spotlight;

  return (
    <div className="eto-panel-editor">
      {/* ID (read-only) */}
      <FieldRow label="ID">
        <input className="eto-panel-input eto-panel-input--mono" value={step.id} readOnly />
      </FieldRow>

      {/* Title */}
      <FieldRow label="Title">
        <input className="eto-panel-input" value={step.title ?? ""}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="Step title" />
      </FieldRow>

      {/* Body */}
      <FieldRow label="Body">
        <textarea className="eto-panel-textarea" value={step.body ?? ""} rows={3}
          onChange={(e) => update({ body: e.target.value })}
          placeholder="Step description…" />
      </FieldRow>

      {/* Selector */}
      <FieldRow label="Selector">
        <input className="eto-panel-input eto-panel-input--mono" value={step.selector ?? ""}
          onChange={(e) => update({ selector: e.target.value || undefined })}
          placeholder='[data-tour="my-element"]' />
      </FieldRow>

      {/* Toggles row */}
      <div className="eto-panel-toggles">
        <ToggleButton
          label="Spotlight"
          active={hasSpotlight}
          onChange={(on) => update({
            annotations: { ...(step.annotations ?? {}), spotlight: on },
          })}
        />
        <ToggleButton
          label="Highlight"
          active={!!step.highlight}
          onChange={(on) => update({ highlight: on || undefined })}
        />
        <ToggleButton
          label="Scroll"
          active={!!step.scrollIntoView}
          onChange={(on) => update({ scrollIntoView: on || undefined })}
        />
      </div>

      {/* Arrow section */}
      <div className="eto-panel-section">
        <div className="eto-panel-section-header">
          <ToggleButton
            label="Arrow"
            active={hasArrow}
            onChange={(on) => {
              if (on) {
                // Create default arrow
                update({
                  annotations: {
                    ...(step.annotations ?? {}),
                    arrow: { to: targetPoint(50, 50) },
                  },
                });
              } else {
                const a = { ...(step.annotations ?? {}) };
                delete a.arrow;
                update({ annotations: a });
              }
            }}
          />
        </div>
        {hasArrow && (
          <div className="eto-panel-arrow-fields">
            <FieldRow label="Tip X%">
              <input className="eto-panel-input eto-panel-input--narrow" type="number"
                value={Math.round(step.annotations!.arrow!.to.x)}
                onChange={(e) => update({
                  annotations: {
                    ...step.annotations,
                    arrow: {
                      ...step.annotations!.arrow!,
                      to: targetPoint(Number(e.target.value), step.annotations!.arrow!.to.y),
                    },
                  },
                })} />
            </FieldRow>
            <FieldRow label="Tip Y%">
              <input className="eto-panel-input eto-panel-input--narrow" type="number"
                value={Math.round(step.annotations!.arrow!.to.y)}
                onChange={(e) => update({
                  annotations: {
                    ...step.annotations,
                    arrow: {
                      ...step.annotations!.arrow!,
                      to: targetPoint(step.annotations!.arrow!.to.x, Number(e.target.value)),
                    },
                  },
                })} />
            </FieldRow>
            <FieldRow label="Bend">
              <input className="eto-panel-input eto-panel-input--narrow" type="number"
                value={step.annotations?.arrow?.style?.bend ?? 30} min={0} max={80}
                onChange={(e) => update({
                  annotations: {
                    ...step.annotations,
                    arrow: {
                      ...step.annotations!.arrow!,
                      style: { ...(step.annotations?.arrow?.style ?? {}), bend: Number(e.target.value) },
                    },
                  },
                })} />
            </FieldRow>
            <div className="eto-panel-toggles">
              <ToggleButton
                label="Flip"
                active={!!step.annotations?.arrow?.style?.flip}
                onChange={(on) => update({
                  annotations: {
                    ...step.annotations,
                    arrow: {
                      ...step.annotations!.arrow!,
                      style: { ...(step.annotations?.arrow?.style ?? {}), flip: on },
                    },
                  },
                })}
              />
              <ToggleButton
                label="Dashed"
                active={!!step.annotations?.arrow?.style?.dashed}
                onChange={(on) => update({
                  annotations: {
                    ...step.annotations,
                    arrow: {
                      ...step.annotations!.arrow!,
                      style: { ...(step.annotations?.arrow?.style ?? {}), dashed: on },
                    },
                  },
                })}
              />
              <ToggleButton
                label="Loop"
                active={!!step.annotations?.arrow?.style?.loopEnd}
                onChange={(on) => update({
                  annotations: {
                    ...step.annotations,
                    arrow: {
                      ...step.annotations!.arrow!,
                      style: { ...(step.annotations?.arrow?.style ?? {}), loopEnd: on },
                    },
                  },
                })}
              />
            </div>
            <FieldRow label="Label">
              <input className="eto-panel-input" value={step.annotations?.arrow?.label ?? ""}
                onChange={(e) => update({
                  annotations: {
                    ...step.annotations,
                    arrow: { ...step.annotations!.arrow!, label: e.target.value || undefined },
                  },
                })}
                placeholder="Arrow label" />
            </FieldRow>
          </div>
        )}
      </div>

      {/* Auto-advance */}
      <FieldRow label="Auto-advance (ms)">
        <input className="eto-panel-input eto-panel-input--narrow" type="number"
          value={step.autoAdvance ?? ""} min={0} step={500}
          onChange={(e) => update({ autoAdvance: e.target.value ? Number(e.target.value) : undefined })}
          placeholder="off" />
      </FieldRow>

      {/* Card anchor */}
      <FieldRow label="Card X (vw)">
        <input className="eto-panel-input eto-panel-input--narrow" type="number"
          value={step.cardAnchor?.x ?? ""} min={0} max={100}
          onChange={(e) => {
            if (!e.target.value) {
              editor.clearCardAnchor(step.id);
            } else {
              const x = Number(e.target.value);
              const y = step.cardAnchor?.y ?? 72;
              editor.setCardAnchor(step.id, { space: "viewport", x, y });
            }
          }}
          placeholder="default" />
      </FieldRow>
      <FieldRow label="Card Y (vh)">
        <input className="eto-panel-input eto-panel-input--narrow" type="number"
          value={step.cardAnchor?.y ?? ""} min={0} max={100}
          onChange={(e) => {
            if (!e.target.value) {
              editor.clearCardAnchor(step.id);
            } else {
              const y = Number(e.target.value);
              const x = step.cardAnchor?.x ?? 50;
              editor.setCardAnchor(step.id, { space: "viewport", x, y });
            }
          }}
          placeholder="default" />
      </FieldRow>

      {/* Actions row: move, duplicate, delete */}
      <div className="eto-panel-actions">
        <button type="button" className="eto-panel-action" title="Move up"
          disabled={index === 0} onClick={() => editor.moveStep(step.id, "up")}>
          <UpIcon />
        </button>
        <button type="button" className="eto-panel-action" title="Move down"
          disabled={index === total - 1} onClick={() => editor.moveStep(step.id, "down")}>
          <DownIcon />
        </button>
        <button type="button" className="eto-panel-action" title="Duplicate step"
          onClick={() => {
            const dup: Step<unknown> = {
              ...step,
              id: `${step.id}-copy-${Date.now()}`,
              title: `${step.title ?? ""} (copy)`,
            };
            editor.addStep(dup);
          }}>
          <CopyIcon />
        </button>
        <button type="button" className="eto-panel-action eto-panel-action--danger" title="Delete step"
          onClick={() => {
            if (confirm(`Delete step "${step.title || step.id}"?`)) {
              editor.removeStep(step.id);
            }
          }}>
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="eto-panel-field">
      <label className="eto-panel-field-label">{label}</label>
      {children}
    </div>
  );
}

function ToggleButton({ label, active, onChange }: { label: string; active: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button"
      className={`eto-panel-toggle-btn${active ? " eto-panel-toggle-btn--on" : ""}`}
      onClick={() => onChange(!active)}>
      {label}
    </button>
  );
}

function unsavedCountOf(o: any): number {
  if (!o) return 0;
  return (
    Object.keys(o.cardAnchors ?? {}).length +
    Object.keys(o.arrowTips ?? {}).length +
    Object.keys(o.circles ?? {}).length +
    Object.keys(o.newArrows ?? {}).length +
    Object.keys(o.stepEdits ?? {}).length +
    (o.addedSteps?.length ?? 0) +
    (o.removedIds?.length ?? 0)
  );
}