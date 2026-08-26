"use client";

/**
 * @module editor/FeatureEditor
 *
 * The panel section for wiring a step to the host's own behaviour.
 *
 * Features are only half the story: being able to *call* the app from a
 * step is worth much less if authoring that call means hand-writing
 * `{"type":"feature","name":"…","args":[…]}` and knowing the argument
 * order. Because a feature declares its parameters, the editor can offer
 * a menu of what this app can do and draw a form for each one — so a tour
 * that drives the application can be built by clicking.
 */

import * as React from "react";
import { useMemo } from "react";
import { useFeatureList } from "../core/features";
import type { FeatureDescriptor, FeatureParam, Step, StepAction } from "../types";

// ── Argument coercion ───────────────────────────────────────────────────

/**
 * Turn a form field's string into the value the feature expects.
 *
 * Steps are stored as JSON, so an argument has to survive a round trip
 * through a file. Anything unparsable falls back to the raw string rather
 * than throwing — a half-typed value is a normal state in a text input.
 */
export function coerceParam(param: FeatureParam, raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "") return param.defaultValue ?? undefined;

  switch (param.type) {
    case "number": {
      const n = Number(trimmed);
      return Number.isFinite(n) ? n : trimmed;
    }
    case "boolean":
      return trimmed === "true";
    case "string[]":
      return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
    case "json":
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed;
      }
    default:
      return trimmed;
  }
}

/** Render a stored argument back into its form field. */
export function formatParam(param: FeatureParam, value: unknown): string {
  if (value === undefined || value === null) return "";
  if (param.type === "string[]") {
    return Array.isArray(value) ? value.join(", ") : String(value);
  }
  if (param.type === "json") {
    return typeof value === "string" ? value : JSON.stringify(value);
  }
  return String(value);
}

// ── Section ─────────────────────────────────────────────────────────────

export function FeatureEditor(props: {
  step: Step<unknown>;
  update: (patch: Partial<Step<unknown>>) => void;
}) {
  const { step, update } = props;
  const features = useFeatureList();
  const runnable = useMemo(() => features.filter((f) => f.runnable), [features]);

  const actions = step.actions ?? [];
  const featureActions = actions
    .map((action, index) => ({ action, index }))
    .filter((entry): entry is { action: Extract<StepAction, { type: "feature" }>; index: number } =>
      entry.action.type === "feature");

  const setAction = (index: number, next: StepAction) => {
    const copy = [...actions];
    copy[index] = next;
    update({ actions: copy });
  };

  const removeAction = (index: number) => {
    const copy = actions.filter((_, i) => i !== index);
    update({ actions: copy.length > 0 ? copy : undefined });
  };

  const addAction = (name: string) => {
    if (!name) return;
    update({ actions: [...actions, { type: "feature", name, args: [] }] });
  };

  if (runnable.length === 0) {
    return (
      <p className="eto-panel-empty">
        This app has not registered any features. Call{" "}
        <code>useTutorialFeature()</code> in the component that owns the
        behaviour, and it will appear here for steps to use.
      </p>
    );
  }

  return (
    <>
      {featureActions.map(({ action, index }) => {
        const descriptor = runnable.find((f) => f.name === action.name);
        return (
          <FeatureActionRow
            key={`${action.name}-${index}`}
            action={action}
            descriptor={descriptor}
            features={runnable}
            onChange={(next) => setAction(index, next)}
            onRemove={() => removeAction(index)}
          />
        );
      })}

      <select
        className="eto-panel-input"
        value=""
        onChange={(e) => { addAction(e.target.value); e.currentTarget.value = ""; }}
      >
        <option value="">+ Add feature…</option>
        {runnable.map((f) => (
          <option key={f.name} value={f.name}>{f.label}</option>
        ))}
      </select>
    </>
  );
}

// ── One feature call ────────────────────────────────────────────────────

function FeatureActionRow(props: {
  action: Extract<StepAction, { type: "feature" }>;
  descriptor: FeatureDescriptor | undefined;
  features: FeatureDescriptor[];
  onChange: (next: StepAction) => void;
  onRemove: () => void;
}) {
  const { action, descriptor, onChange, onRemove } = props;
  const args = action.args ?? [];

  const setArg = (position: number, value: unknown) => {
    const next = [...args];
    // Pad, so setting the third argument does not silently drop the first
    // two when they are still at their defaults.
    while (next.length < position) next.push(undefined);
    next[position] = value;
    onChange({ ...action, args: next });
  };

  return (
    <div className="eto-panel-feature">
      <div className="eto-panel-feature-head">
        <span className="eto-panel-feature-name" title={descriptor?.description}>
          {descriptor?.label ?? action.name}
        </span>
        <button
          type="button"
          className="eto-panel-feature-remove"
          onClick={onRemove}
          aria-label={`Remove ${action.name}`}
        >
          ×
        </button>
      </div>

      {/* A step can name a feature this build of the app does not
          register — an older tour file, or a renamed feature. Say so
          rather than rendering an empty row. */}
      {!descriptor && (
        <p className="eto-panel-warn">
          <code>{action.name}</code> is not registered by this app. The step
          will do nothing here.
        </p>
      )}

      {descriptor?.description && (
        <p className="eto-panel-hint">{descriptor.description}</p>
      )}

      {descriptor?.params.map((param, position) => (
        <label key={param.name} className="eto-panel-feature-param">
          <span className="eto-panel-feature-label">
            {param.label ?? param.name}
            {param.required && <em aria-hidden="true"> *</em>}
          </span>
          {param.type === "enum" ? (
            <select
              className="eto-panel-input"
              value={String(args[position] ?? "")}
              onChange={(e) => setArg(position, e.target.value || undefined)}
            >
              <option value="">—</option>
              {(param.options ?? []).map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          ) : param.type === "boolean" ? (
            <select
              className="eto-panel-input"
              value={args[position] === undefined ? "" : String(Boolean(args[position]))}
              onChange={(e) =>
                setArg(position, e.target.value === "" ? undefined : e.target.value === "true")
              }
            >
              <option value="">—</option>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : (
            <input
              className="eto-panel-input eto-panel-input--mono"
              value={formatParam(param, args[position])}
              placeholder={
                param.type === "string[]" ? "a, b, c"
                : param.type === "json" ? '{"key":"value"}'
                : param.type
              }
              onChange={(e) => setArg(position, coerceParam(param, e.target.value))}
            />
          )}
        </label>
      ))}
    </div>
  );
}
