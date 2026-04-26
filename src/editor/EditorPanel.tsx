"use client";

/**
 * @module editor/EditorPanel
 *
 * Alpha.13: Figma-style editor panel.
 *   - Range sliders for bend, stroke, head size
 *   - Visual preset buttons for arrow curvature
 *   - Toggle pills for boolean overlays
 *   - Collapsible sections
 *   - Add / duplicate / reorder / delete
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
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="18 15 12 9 6 15" /></svg>
);
const Down = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
);
const Copy = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

// ── Mini arrow preview SVGs for curvature presets ────────────────────

function ArrowPreview({ bend }: { bend: number }) {
  const cp = bend * 0.6;
  return (
    <svg viewBox="0 0 40 20" width="40" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d={`M 4 16 Q 20 ${16 - cp} 36 16`} />
      <polyline points="32,12 36,16 32,20" strokeWidth="1.5" />
    </svg>
  );
}

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
              <button type="button" className="eto-panel-btn" onClick={() => editor.revert()}>Revert</button>
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
  step: Step<unknown>; index: number; total: number;
  isActive: boolean; isExpanded: boolean;
  onToggle: () => void; onSelect: () => void;
  editor: EditorInternalApi;
}) {
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
        <OverlayDots step={step} />
      </div>
      {isExpanded && <StepEditor step={step} index={index} total={total} editor={editor} />}
    </div>
  );
}

/** Mini dots showing which overlays are active. */
function OverlayDots({ step }: { step: Step<unknown> }) {
  const items: { label: string; on: boolean }[] = [
    { label: "S", on: !!step.annotations?.spotlight },
    { label: "H", on: !!step.highlight },
    { label: "→", on: !!step.annotations?.arrow },
  ];
  return (
    <span className="eto-panel-step-dots">
      {items.map((d) => (
        <span key={d.label} className={`eto-panel-dot${d.on ? " eto-panel-dot--on" : ""}`} title={d.label}>{d.label}</span>
      ))}
    </span>
  );
}

// ── Step editor ─────────────────────────────────────────────────────────

function StepEditor({ step, index, total, editor }: {
  step: Step<unknown>; index: number; total: number; editor: EditorInternalApi;
}) {
  const update = useCallback(
    (patch: Partial<Step<unknown>>) => editor.updateStep(step.id, patch),
    [editor, step.id],
  );

  const annotations = step.annotations ?? {};
  const arrow = annotations.arrow;
  const hasArrow = !!arrow;
  const hasSpotlight = !!annotations.spotlight;
  const hasHighlight = !!step.highlight;

  const setAnnotation = useCallback(
    (key: string, value: unknown) => {
      const a = { ...annotations };
      if (value === undefined || value === null || value === false) {
        delete (a as any)[key];
      } else {
        (a as any)[key] = value;
      }
      update({ annotations: a });
    },
    [annotations, update],
  );

  const setArrowStyle = useCallback(
    (patch: Record<string, unknown>) => {
      if (!arrow) return;
      update({
        annotations: {
          ...annotations,
          arrow: { ...arrow, style: { ...(arrow.style ?? {}), ...patch } },
        },
      });
    },
    [annotations, arrow, update],
  );

  return (
    <div className="eto-panel-editor">
      {/* ── Content ── */}
      <Section title="Content">
        <Field label="Title">
          <input className="eto-panel-input" value={step.title ?? ""}
            onChange={(e) => update({ title: e.target.value })} placeholder="Step title" />
        </Field>
        <Field label="Body">
          <textarea className="eto-panel-textarea" value={step.body ?? ""} rows={2}
            onChange={(e) => update({ body: e.target.value })} placeholder="Description…" />
        </Field>
      </Section>

      {/* ── Target ── */}
      <Section title="Target">
        <Field label="CSS selector">
          <input className="eto-panel-input eto-panel-input--mono" value={step.selector ?? ""}
            onChange={(e) => update({ selector: e.target.value || undefined })}
            placeholder='[data-tour="element"]' />
        </Field>
      </Section>

      {/* ── Overlays ── */}
      <Section title="Overlays">
        <div className="eto-panel-toggles">
          <Pill label="Spotlight" active={hasSpotlight}
            onChange={(on) => setAnnotation("spotlight", on || undefined)} />
          <Pill label="Highlight" active={hasHighlight}
            onChange={(on) => update({ highlight: on || undefined })} />
          <Pill label="Arrow" active={hasArrow}
            onChange={(on) => setAnnotation("arrow", on ? { to: targetPoint(50, 50) } : undefined)} />
          <Pill label="Auto-scroll" active={!!step.scrollIntoView}
            onChange={(on) => update({ scrollIntoView: on || undefined })} />
        </div>
      </Section>

      {/* ── Arrow config ── */}
      {hasArrow && (
        <Section title="Arrow">
          {/* Curvature presets */}
          <Field label="Curve">
            <div className="eto-panel-presets">
              {[
                { label: "Straight", bend: 5 },
                { label: "Gentle", bend: 20 },
                { label: "Curved", bend: 40 },
                { label: "Strong", bend: 65 },
              ].map((p) => (
                <button key={p.label} type="button"
                  className={`eto-panel-preset${(arrow.style?.bend ?? 30) === p.bend ? " eto-panel-preset--active" : ""}`}
                  onClick={() => setArrowStyle({ bend: p.bend })}
                  title={p.label}>
                  <ArrowPreview bend={p.bend} />
                </button>
              ))}
            </div>
          </Field>

          {/* Bend slider */}
          <Slider label="Bend" value={arrow.style?.bend ?? 30} min={0} max={80}
            onChange={(v) => setArrowStyle({ bend: v })} unit="°" />

          {/* Stroke slider */}
          <Slider label="Stroke" value={arrow.style?.strokeWidth ?? 1.5} min={0.5} max={6} step={0.5}
            onChange={(v) => setArrowStyle({ strokeWidth: v })} unit="px" />

          {/* Head size slider */}
          <Slider label="Head" value={arrow.style?.headSize ?? 8} min={4} max={16}
            onChange={(v) => setArrowStyle({ headSize: v })} unit="px" />

          {/* Style toggles */}
          <div className="eto-panel-toggles">
            <Pill label="Flip" active={!!arrow.style?.flip}
              onChange={(on) => setArrowStyle({ flip: on })} />
            <Pill label="Dashed" active={!!arrow.style?.dashed}
              onChange={(on) => setArrowStyle({ dashed: on })} />
            <Pill label="Loop end" active={!!arrow.style?.loopEnd}
              onChange={(on) => setArrowStyle({ loopEnd: on })} />
          </div>

          {/* Label */}
          <Field label="Label">
            <input className="eto-panel-input" value={arrow.label ?? ""}
              onChange={(e) => update({
                annotations: { ...annotations, arrow: { ...arrow, label: e.target.value || undefined } },
              })}
              placeholder="Arrow label" />
          </Field>
        </Section>
      )}

      {/* ── Timing ── */}
      <Section title="Timing">
        <Slider label="Auto-advance" value={step.autoAdvance ?? 0} min={0} max={10000} step={500}
          onChange={(v) => update({ autoAdvance: v || undefined })}
          unit="ms" formatValue={(v) => v === 0 ? "off" : `${(v / 1000).toFixed(1)}s`} />
      </Section>

      {/* ── Position (per-step override) ── */}
      <Section title="Position (this step only)" collapsible defaultOpen={false}>
        <p className="eto-panel-hint">
          Leave empty to use the global position (set via "Move all" in the toolbar).
        </p>
        <Field label="X">
          <div className="eto-panel-inline">
            <input className="eto-panel-input eto-panel-input--narrow" type="number"
              value={step.cardAnchor?.x ?? ""}
              onChange={(e) => {
                if (!e.target.value) { editor.clearCardAnchor(step.id); return; }
                editor.setCardAnchor(step.id, { space: "viewport", x: Number(e.target.value), y: step.cardAnchor?.y ?? 700 });
              }} placeholder="global" />
            <span className="eto-panel-unit">px</span>
          </div>
        </Field>
        <Field label="Y">
          <div className="eto-panel-inline">
            <input className="eto-panel-input eto-panel-input--narrow" type="number"
              value={step.cardAnchor?.y ?? ""}
              onChange={(e) => {
                if (!e.target.value) { editor.clearCardAnchor(step.id); return; }
                editor.setCardAnchor(step.id, { space: "viewport", x: step.cardAnchor?.x ?? 420, y: Number(e.target.value) });
              }} placeholder="global" />
            <span className="eto-panel-unit">px</span>
          </div>
        </Field>
      </Section>

      {/* ── Step ID (read-only) ── */}
      <div className="eto-panel-id">
        <span className="eto-panel-id-label">ID</span>
        <code className="eto-panel-id-value">{step.id}</code>
      </div>

      {/* ── Actions ── */}
      <div className="eto-panel-actions">
        <button type="button" className="eto-panel-action" title="Move up"
          disabled={index === 0} onClick={() => editor.moveStep(step.id, "up")}><Up /></button>
        <button type="button" className="eto-panel-action" title="Move down"
          disabled={index === total - 1} onClick={() => editor.moveStep(step.id, "down")}><Down /></button>
        <button type="button" className="eto-panel-action" title="Duplicate"
          onClick={() => editor.addStep({ ...step, id: `${step.id}-copy-${Date.now()}`, title: `${step.title ?? ""} (copy)` })}><Copy /></button>
        <div style={{ flex: 1 }} />
        <button type="button" className="eto-panel-action eto-panel-action--danger" title="Delete"
          onClick={() => { if (confirm(`Delete "${step.title || step.id}"?`)) editor.removeStep(step.id); }}><Trash /></button>
      </div>
    </div>
  );
}

// ── Reusable components ─────────────────────────────────────────────────

function Section({ title, children, collapsible, defaultOpen = true }: {
  title: string; children: React.ReactNode; collapsible?: boolean; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isCollapsible = collapsible ?? false;

  return (
    <div className="eto-panel-section">
      <div className={`eto-panel-section-title${isCollapsible ? " eto-panel-section-title--btn" : ""}`}
        onClick={isCollapsible ? () => setOpen((o) => !o) : undefined}
        role={isCollapsible ? "button" : undefined}>
        {title}
        {isCollapsible && <Chevron open={open} />}
      </div>
      {(!isCollapsible || open) && (
        <div className="eto-panel-section-body">{children}</div>
      )}
    </div>
  );
}

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

function Slider({ label, value, min, max, step = 1, unit, onChange, formatValue }: {
  label: string; value: number; min: number; max: number; step?: number;
  unit?: string; onChange: (v: number) => void;
  formatValue?: (v: number) => string;
}) {
  const display = formatValue ? formatValue(value) : `${Math.round(value * 10) / 10}`;
  return (
    <div className="eto-panel-slider-row">
      <label className="eto-panel-field-label">{label}</label>
      <input type="range" className="eto-panel-slider"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} />
      <span className="eto-panel-slider-val">{display}{unit && <span className="eto-panel-unit">{unit}</span>}</span>
    </div>
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