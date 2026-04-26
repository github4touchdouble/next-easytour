"use client";

/**
 * @module editor/EditorPanel
 *
 * Alpha.10: PowerPoint-style step editor panel.
 *
 *   - Simple view: toggle overlays on/off, edit text, drag to reorder.
 *   - Advanced view: raw number fields for arrow tip, bend, card position.
 *   - Every step expandable — first step works identically to all others.
 *   - Add / duplicate / delete steps.
 */

import * as React from "react";
import { useCallback, useState } from "react";
import { useTutorial } from "../core/Tutorial";
import { useEditor, type EditorInternalApi } from "./Editor";
import { OverlayPortal } from "../core/OverlayPortal";
import { targetPoint } from "../coords";
import type { Step } from "../types";

// ── Icons ───────────────────────────────────────────────────────────────

const Chevron = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round"
    style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms", flexShrink: 0 }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const Plus = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const Trash = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
  </svg>
);
const Up = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);
const Down = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const Copy = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const Gear = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06c.5.5 1.14.7 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.26.68.08 1.36-.33 1.82l-.06.06z" />
  </svg>
);

// ── Panel ───────────────────────────────────────────────────────────────

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
  const unsaved = unsavedCount(editor.overrides);
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
    editor.addStep({ id, title: "New step", body: "" });
    setExpandedSteps((prev) => new Set(prev).add(id));
    setTimeout(() => goto(id), 50);
  };

  return (
    <OverlayPortal>
    <div className="eto-editor-panel" style={{ [side]: 0 }} data-collapsed={collapsed || undefined}>
      <div className="eto-panel-header">
        <button type="button" className="eto-panel-toggle" onClick={() => setCollapsed((c) => !c)}>
          <Chevron open={!collapsed} />
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
          <div className="eto-panel-steps">
            {steps.map((s, i) => (
              <StepCard key={s.id} step={s} index={i} total={steps.length}
                isActive={activeStep?.id === s.id}
                isExpanded={expandedSteps.has(s.id)}
                onToggle={() => toggleExpand(s.id)}
                onSelect={() => goto(s.id)}
                editor={editor} />
            ))}
          </div>

          <button type="button" className="eto-panel-add" onClick={onAddStep}>
            <Plus /> Add step
          </button>

          <div className="eto-panel-footer">
            <button type="button"
              className={`eto-panel-btn eto-panel-btn--save${saved ? " eto-panel-btn--saved" : ""}`}
              onClick={() => editor.save()} disabled={unsaved === 0 || saving}>
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

// ── Step card ───────────────────────────────────────────────────────────

function StepCard({ step, index, total, isActive, isExpanded, onToggle, onSelect, editor }: {
  step: Step<unknown>;
  index: number;
  total: number;
  isActive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
  editor: EditorInternalApi;
}) {
  const hasArrow = !!step.annotations?.arrow;
  const hasSpotlight = !!step.annotations?.spotlight;
  const hasHighlight = !!step.highlight;

  return (
    <div className={`eto-panel-step${isActive ? " eto-panel-step--active" : ""}`}>
      <div className="eto-panel-step-header">
        <button type="button" className="eto-panel-step-expand" onClick={onToggle}>
          <Chevron open={isExpanded} />
        </button>
        <button type="button" className="eto-panel-step-select" onClick={onSelect}>
          <span className="eto-panel-step-num">{index + 1}</span>
          <span className="eto-panel-step-title">{step.title || step.id}</span>
        </button>
        <span className="eto-panel-step-badges">
          {hasArrow && <span className="eto-panel-badge" title="Arrow">→</span>}
          {hasSpotlight && <span className="eto-panel-badge" title="Spotlight">◎</span>}
          {hasHighlight && <span className="eto-panel-badge" title="Highlight">◉</span>}
        </span>
      </div>

      {isExpanded && (
        <StepEditor step={step} index={index} total={total} editor={editor} />
      )}
    </div>
  );
}

// ── Step editor ─────────────────────────────────────────────────────────

function StepEditor({ step, index, total, editor }: {
  step: Step<unknown>;
  index: number;
  total: number;
  editor: EditorInternalApi;
}) {
  const [advanced, setAdvanced] = useState(false);

  const update = useCallback(
    (patch: Partial<Step<unknown>>) => editor.updateStep(step.id, patch),
    [editor, step.id],
  );

  const hasArrow = !!step.annotations?.arrow;
  const hasSpotlight = !!step.annotations?.spotlight;
  const hasHighlight = !!step.highlight;

  return (
    <div className="eto-panel-editor">
      {/* ── Content ── */}
      <Field label="Title">
        <input className="eto-panel-input" value={step.title ?? ""}
          onChange={(e) => update({ title: e.target.value })} placeholder="Step title" />
      </Field>

      <Field label="Body">
        <textarea className="eto-panel-textarea" value={step.body ?? ""} rows={2}
          onChange={(e) => update({ body: e.target.value })} placeholder="Description…" />
      </Field>

      <Field label="Target">
        <input className="eto-panel-input eto-panel-input--mono" value={step.selector ?? ""}
          onChange={(e) => update({ selector: e.target.value || undefined })}
          placeholder='[data-tour="element"]' />
      </Field>

      {/* ── Overlays — visual toggles ── */}
      <div className="eto-panel-section-label">Overlays</div>
      <div className="eto-panel-toggles">
        <Pill label="Spotlight" active={hasSpotlight} onChange={(on) => {
          const a = { ...(step.annotations ?? {}) };
          if (on) { a.spotlight = true; } else { delete a.spotlight; }
          update({ annotations: a });
        }} />
        <Pill label="Highlight" active={hasHighlight} onChange={(on) =>
          update({ highlight: on || undefined })} />
        <Pill label="Arrow" active={hasArrow} onChange={(on) => {
          const a = { ...(step.annotations ?? {}) };
          if (on) { a.arrow = { to: targetPoint(50, 50) }; } else { delete a.arrow; }
          update({ annotations: a });
        }} />
        <Pill label="Auto-scroll" active={!!step.scrollIntoView} onChange={(on) =>
          update({ scrollIntoView: on || undefined })} />
      </div>

      {/* Arrow style pills (shown when arrow is on) */}
      {hasArrow && (
        <>
          <div className="eto-panel-section-label">Arrow style</div>
          <div className="eto-panel-toggles">
            <Pill label="Flip" active={!!step.annotations?.arrow?.style?.flip} onChange={(on) =>
              update({ annotations: { ...step.annotations, arrow: { ...step.annotations!.arrow!, style: { ...(step.annotations?.arrow?.style ?? {}), flip: on } } } })} />
            <Pill label="Dashed" active={!!step.annotations?.arrow?.style?.dashed} onChange={(on) =>
              update({ annotations: { ...step.annotations, arrow: { ...step.annotations!.arrow!, style: { ...(step.annotations?.arrow?.style ?? {}), dashed: on } } } })} />
            <Pill label="Loop end" active={!!step.annotations?.arrow?.style?.loopEnd} onChange={(on) =>
              update({ annotations: { ...step.annotations, arrow: { ...step.annotations!.arrow!, style: { ...(step.annotations?.arrow?.style ?? {}), loopEnd: on } } } })} />
          </div>
          <Field label="Label">
            <input className="eto-panel-input" value={step.annotations?.arrow?.label ?? ""}
              onChange={(e) => update({ annotations: { ...step.annotations, arrow: { ...step.annotations!.arrow!, label: e.target.value || undefined } } })}
              placeholder="Arrow label" />
          </Field>
        </>
      )}

      {/* ── Timing ── */}
      <Field label="Auto-advance">
        <div className="eto-panel-inline">
          <input className="eto-panel-input eto-panel-input--narrow" type="number"
            value={step.autoAdvance ?? ""} min={0} step={500}
            onChange={(e) => update({ autoAdvance: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="off" />
          <span className="eto-panel-unit">ms</span>
        </div>
      </Field>

      {/* ── Advanced toggle ── */}
      <button type="button" className="eto-panel-advanced-toggle" onClick={() => setAdvanced((v) => !v)}>
        <Gear />
        <span>{advanced ? "Hide advanced" : "Advanced"}</span>
        <Chevron open={advanced} />
      </button>

      {advanced && (
        <div className="eto-panel-advanced">
          <Field label="Step ID">
            <input className="eto-panel-input eto-panel-input--mono" value={step.id} readOnly />
          </Field>

          {hasArrow && (
            <>
              <Field label="Arrow tip X">
                <div className="eto-panel-inline">
                  <input className="eto-panel-input eto-panel-input--narrow" type="number"
                    value={Math.round(step.annotations!.arrow!.to.x)}
                    onChange={(e) => update({ annotations: { ...step.annotations, arrow: { ...step.annotations!.arrow!, to: targetPoint(Number(e.target.value), step.annotations!.arrow!.to.y) } } })} />
                  <span className="eto-panel-unit">%</span>
                </div>
              </Field>
              <Field label="Arrow tip Y">
                <div className="eto-panel-inline">
                  <input className="eto-panel-input eto-panel-input--narrow" type="number"
                    value={Math.round(step.annotations!.arrow!.to.y)}
                    onChange={(e) => update({ annotations: { ...step.annotations, arrow: { ...step.annotations!.arrow!, to: targetPoint(step.annotations!.arrow!.to.x, Number(e.target.value)) } } })} />
                  <span className="eto-panel-unit">%</span>
                </div>
              </Field>
              <Field label="Bend">
                <div className="eto-panel-inline">
                  <input className="eto-panel-input eto-panel-input--narrow" type="number"
                    value={step.annotations?.arrow?.style?.bend ?? 30} min={0} max={80}
                    onChange={(e) => update({ annotations: { ...step.annotations, arrow: { ...step.annotations!.arrow!, style: { ...(step.annotations?.arrow?.style ?? {}), bend: Number(e.target.value) } } } })} />
                  <span className="eto-panel-unit">°</span>
                </div>
              </Field>
              <Field label="Stroke">
                <div className="eto-panel-inline">
                  <input className="eto-panel-input eto-panel-input--narrow" type="number"
                    value={step.annotations?.arrow?.style?.strokeWidth ?? 1.5} min={0.5} max={6} step={0.5}
                    onChange={(e) => update({ annotations: { ...step.annotations, arrow: { ...step.annotations!.arrow!, style: { ...(step.annotations?.arrow?.style ?? {}), strokeWidth: Number(e.target.value) } } } })} />
                  <span className="eto-panel-unit">px</span>
                </div>
              </Field>
            </>
          )}

          <Field label="Card X (step)">
            <div className="eto-panel-inline">
              <input className="eto-panel-input eto-panel-input--narrow" type="number"
                value={step.cardAnchor?.x ?? ""}
                onChange={(e) => {
                  if (!e.target.value) { editor.clearCardAnchor(step.id); }
                  else { editor.setCardAnchor(step.id, { space: "viewport", x: Number(e.target.value), y: step.cardAnchor?.y ?? 700 }); }
                }} placeholder="global" />
              <span className="eto-panel-unit">px</span>
            </div>
          </Field>
          <Field label="Card Y (step)">
            <div className="eto-panel-inline">
              <input className="eto-panel-input eto-panel-input--narrow" type="number"
                value={step.cardAnchor?.y ?? ""}
                onChange={(e) => {
                  if (!e.target.value) { editor.clearCardAnchor(step.id); }
                  else { editor.setCardAnchor(step.id, { space: "viewport", x: step.cardAnchor?.x ?? 420, y: Number(e.target.value) }); }
                }} placeholder="global" />
              <span className="eto-panel-unit">px</span>
            </div>
          </Field>
        </div>
      )}

      {/* ── Actions row ── */}
      <div className="eto-panel-actions">
        <button type="button" className="eto-panel-action" title="Move up"
          disabled={index === 0} onClick={() => editor.moveStep(step.id, "up")}><Up /></button>
        <button type="button" className="eto-panel-action" title="Move down"
          disabled={index === total - 1} onClick={() => editor.moveStep(step.id, "down")}><Down /></button>
        <button type="button" className="eto-panel-action" title="Duplicate"
          onClick={() => editor.addStep({ ...step, id: `${step.id}-copy-${Date.now()}`, title: `${step.title ?? ""} (copy)` })}><Copy /></button>
        <button type="button" className="eto-panel-action eto-panel-action--danger" title="Delete"
          onClick={() => { if (confirm(`Delete "${step.title || step.id}"?`)) editor.removeStep(step.id); }}><Trash /></button>
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="eto-panel-field">
      <label className="eto-panel-field-label">{label}</label>
      {children}
    </div>
  );
}

function Pill({ label, active, onChange }: { label: string; active: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button"
      className={`eto-panel-pill${active ? " eto-panel-pill--on" : ""}`}
      onClick={() => onChange(!active)}>
      {label}
    </button>
  );
}

function unsavedCount(o: any): number {
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