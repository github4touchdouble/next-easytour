/**
 * @module core/state
 *
 * Pure state logic. Alpha.3: adds "waiting" status and isWaiting field.
 */

import type { Step, TutorialApi, TutorialStatus } from "../types";

// ── Snapshot ─────────────────────────────────────────────────────────────

export interface SnapshotInput<Meta> {
  steps: Step<Meta>[];
  stepId: string | null;
  transitioning: boolean;
  canAdvance: boolean;
  isWaiting: boolean;
}

export function computeSnapshot<Meta>(
  input: SnapshotInput<Meta>,
): Omit<TutorialApi<Meta>, "next" | "prev" | "goto" | "close" | "getTargetElement" | "defaultCardAnchor"> {
  const { steps, stepId, transitioning, canAdvance, isWaiting } = input;

  const total = steps.length;
  const index = stepId === null ? -1 : steps.findIndex((s) => s.id === stepId);
  const step = index >= 0 ? steps[index] ?? null : null;

  const status: TutorialStatus =
    step === null
      ? "closed"
      : transitioning
        ? "transitioning"
        : isWaiting
          ? "waiting"
          : !canAdvance
            ? "blocked"
            : "running";

  return {
    status,
    step,
    index,
    total,
    isFirst: index === 0,
    isLast: index >= 0 && index === total - 1,
    canAdvance: canAdvance && !isWaiting,
    isWaiting,
  };
}

// ── Navigation intents ──────────────────────────────────────────────────

export interface NavigationIntent<Meta> {
  toId: string | null;
  leavingStep: Step<Meta> | null;
  leavingIndex: number;
  enteringStep: Step<Meta> | null;
  enteringIndex: number;
  kind: "open" | "close" | "step" | "noop";
}

type Maybe<Meta> = NavigationIntent<Meta> | null;

export interface NavInput<Meta> {
  steps: Step<Meta>[];
  stepId: string | null;
  canAdvance: boolean;
}

export function computeNext<Meta>(input: NavInput<Meta>): Maybe<Meta> {
  const { steps, stepId, canAdvance } = input;
  if (stepId === null) return null;
  if (!canAdvance) return null;
  const i = steps.findIndex((s) => s.id === stepId);
  if (i < 0) return null;
  const current = steps[i];
  if (i === steps.length - 1) {
    return { toId: null, leavingStep: current, leavingIndex: i, enteringStep: null, enteringIndex: -1, kind: "close" };
  }
  const nextStep = steps[i + 1];
  return { toId: nextStep.id, leavingStep: current, leavingIndex: i, enteringStep: nextStep, enteringIndex: i + 1, kind: "step" };
}

export function computePrev<Meta>(input: NavInput<Meta>): Maybe<Meta> {
  const { steps, stepId } = input;
  if (stepId === null) return null;
  const i = steps.findIndex((s) => s.id === stepId);
  if (i <= 0) return null;
  const prev = steps[i - 1];
  return { toId: prev.id, leavingStep: steps[i], leavingIndex: i, enteringStep: prev, enteringIndex: i - 1, kind: "step" };
}

export function computeGoto<Meta>(input: NavInput<Meta>, toId: string): Maybe<Meta> {
  const { steps, stepId } = input;
  const target = steps.findIndex((s) => s.id === toId);
  if (target < 0) return null;
  if (toId === stepId) return null;
  const toStep = steps[target];
  if (stepId === null) {
    return { toId, leavingStep: null, leavingIndex: -1, enteringStep: toStep, enteringIndex: target, kind: "open" };
  }
  const fromIndex = steps.findIndex((s) => s.id === stepId);
  return { toId, leavingStep: fromIndex >= 0 ? steps[fromIndex] : null, leavingIndex: fromIndex, enteringStep: toStep, enteringIndex: target, kind: "step" };
}

export function computeClose<Meta>(input: NavInput<Meta>): Maybe<Meta> {
  const { steps, stepId } = input;
  if (stepId === null) return null;
  const i = steps.findIndex((s) => s.id === stepId);
  const current = i >= 0 ? steps[i] : null;
  return { toId: null, leavingStep: current, leavingIndex: i, enteringStep: null, enteringIndex: -1, kind: "close" };
}

// ── Validation ──────────────────────────────────────────────────────────

export function validateSteps<Meta>(steps: Step<Meta>[]): string[] {
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (!s.id || s.id.trim() === "") { warnings.push(`step[${i}] has no id`); continue; }
    if (seen.has(s.id)) warnings.push(`duplicate step id: "${s.id}"`);
    seen.add(s.id);
    const hasContent = s.title || s.body || s.content;
    const hasAnnotations = s.annotations?.arrow || (s.annotations?.circles && s.annotations.circles.length > 0) || s.annotations?.spotlight;
    if (!hasContent && !hasAnnotations) warnings.push(`step "${s.id}" has neither content nor annotations`);
  }
  return warnings;
}