/**
 * @module core/state
 *
 * Pure state logic for the tutorial. Given the inputs a consumer hands
 * to `<Tutorial>` plus a small amount of internal state (transition
 * flag), this module computes:
 *
 *   1. The derived `TutorialApi` snapshot exposed to child components.
 *   2. The *intent* of navigation calls (`next`, `prev`, `goto`,
 *      `close`) as plain descriptions — what step id we're moving to,
 *      which lifecycle callbacks should fire, in what order.
 *
 * Why separate intent from execution. React state updates and effect
 * callbacks belong in the Provider (Layer 3). Keeping this layer pure
 * means every possible transition is a function call I can unit-test
 * without jsdom, without timers, without mocking setState. The
 * Provider consumes these intents and performs the side effects in
 * order.
 *
 * This module is internal. Nothing here is re-exported from the
 * package root.
 */

import type { Step, TutorialApi, TutorialStatus } from "../types";

// ────────────────────────────────────────────────────────────────────────
// Snapshot computation
// ────────────────────────────────────────────────────────────────────────

export interface SnapshotInput<Meta> {
  steps: Step<Meta>[];
  stepId: string | null;
  /** Internal flag set true for ~80 ms during step-to-step fades. */
  transitioning: boolean;
  /** Host-supplied predicate, already evaluated by the caller. */
  canAdvance: boolean;
}

/**
 * Derive the full `TutorialApi` snapshot from inputs. Pure: same
 * inputs always yield the same output. The Provider calls this on
 * every render and memoises the result by input identity.
 *
 * The returned `next`, `prev`, `goto`, and `close` methods are
 * stubs — they throw. The Provider replaces them with real
 * callbacks bound to its own state. Keeping the snapshot-shape
 * separate from the navigation-shape lets the types be strict
 * without introducing optionals.
 */
export function computeSnapshot<Meta>(
  input: SnapshotInput<Meta>,
): Omit<TutorialApi<Meta>, "next" | "prev" | "goto" | "close"> {
  const { steps, stepId, transitioning, canAdvance } = input;

  const total = steps.length;
  const index = stepId === null ? -1 : steps.findIndex((s) => s.id === stepId);
  const step = index >= 0 ? steps[index] ?? null : null;

  const status: TutorialStatus =
    step === null
      ? "closed"
      : transitioning
        ? "transitioning"
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
    canAdvance,
  };
}

// ────────────────────────────────────────────────────────────────────────
// Navigation intents
// ────────────────────────────────────────────────────────────────────────

/**
 * An intent says "navigation should take you to id X, with side
 * effects of Y". The Provider is responsible for:
 *
 *   1. Calling `onStepLeave(fromStep, fromIndex)` if `leavingStep` is set.
 *   2. Calling `onStepChange(toId)` to let the host update its state.
 *   3. Calling `onStepEnter(toStep, toIndex)` after the controlled
 *      `stepId` prop has changed and the new step is active.
 *   4. Calling `onOpen` / `onClose` on coarse transitions.
 *
 * An intent of `null` means "this navigation is a no-op" — e.g.
 * calling `prev()` while at the first step, or `goto("x")` with an
 * id that doesn't exist. The Provider silently does nothing.
 */
export interface NavigationIntent<Meta> {
  /** The id to move to. `null` means "close the tour". */
  toId: string | null;
  /** The step being left, if any. Drives `onStepLeave` and `onClose`. */
  leavingStep: Step<Meta> | null;
  leavingIndex: number;
  /** The step being entered, if any. Drives `onStepEnter` and `onOpen`. */
  enteringStep: Step<Meta> | null;
  enteringIndex: number;
  /** Coarse transition, for lifecycle callbacks. */
  kind: "open" | "close" | "step" | "noop";
}

/** Result of every navigation call: either an intent, or a no-op marker. */
type Maybe<Meta> = NavigationIntent<Meta> | null;

export interface NavInput<Meta> {
  steps: Step<Meta>[];
  stepId: string | null;
  /** For `next()`: is the tour blocked? If so, `next` is a no-op. */
  canAdvance: boolean;
}

// ── next ────────────────────────────────────────────────────────────────

/**
 * Compute the intent of `next()`. Advances to the following step, or
 * closes the tour if called on the last step. No-op when closed or
 * blocked.
 */
export function computeNext<Meta>(input: NavInput<Meta>): Maybe<Meta> {
  const { steps, stepId, canAdvance } = input;
  if (stepId === null) return null;
  if (!canAdvance) return null;
  const i = steps.findIndex((s) => s.id === stepId);
  if (i < 0) return null;
  const current = steps[i];
  if (i === steps.length - 1) {
    // Last step → close.
    return {
      toId: null,
      leavingStep: current,
      leavingIndex: i,
      enteringStep: null,
      enteringIndex: -1,
      kind: "close",
    };
  }
  const nextStep = steps[i + 1];
  return {
    toId: nextStep.id,
    leavingStep: current,
    leavingIndex: i,
    enteringStep: nextStep,
    enteringIndex: i + 1,
    kind: "step",
  };
}

// ── prev ────────────────────────────────────────────────────────────────

/**
 * Compute the intent of `prev()`. Steps back one index. No-op when
 * closed or already on the first step. `canAdvance` does not gate
 * backward navigation — users can always retreat.
 */
export function computePrev<Meta>(input: NavInput<Meta>): Maybe<Meta> {
  const { steps, stepId } = input;
  if (stepId === null) return null;
  const i = steps.findIndex((s) => s.id === stepId);
  if (i <= 0) return null;
  const prev = steps[i - 1];
  return {
    toId: prev.id,
    leavingStep: steps[i],
    leavingIndex: i,
    enteringStep: prev,
    enteringIndex: i - 1,
    kind: "step",
  };
}

// ── goto ────────────────────────────────────────────────────────────────

/**
 * Jump to an arbitrary step by id. No-op if the id doesn't match any
 * step. When the tour is currently closed, the transition is "open";
 * otherwise it's a "step".
 */
export function computeGoto<Meta>(
  input: NavInput<Meta>,
  toId: string,
): Maybe<Meta> {
  const { steps, stepId } = input;
  const target = steps.findIndex((s) => s.id === toId);
  if (target < 0) return null;
  if (toId === stepId) return null;

  const toStep = steps[target];

  if (stepId === null) {
    // Opening the tour.
    return {
      toId,
      leavingStep: null,
      leavingIndex: -1,
      enteringStep: toStep,
      enteringIndex: target,
      kind: "open",
    };
  }

  // Jumping between active steps.
  const fromIndex = steps.findIndex((s) => s.id === stepId);
  return {
    toId,
    leavingStep: fromIndex >= 0 ? steps[fromIndex] : null,
    leavingIndex: fromIndex,
    enteringStep: toStep,
    enteringIndex: target,
    kind: "step",
  };
}

// ── close ───────────────────────────────────────────────────────────────

/** Compute the intent of `close()`. No-op when already closed. */
export function computeClose<Meta>(input: NavInput<Meta>): Maybe<Meta> {
  const { steps, stepId } = input;
  if (stepId === null) return null;
  const i = steps.findIndex((s) => s.id === stepId);
  const current = i >= 0 ? steps[i] : null;
  return {
    toId: null,
    leavingStep: current,
    leavingIndex: i,
    enteringStep: null,
    enteringIndex: -1,
    kind: "close",
  };
}

// ────────────────────────────────────────────────────────────────────────
// Validation
// ────────────────────────────────────────────────────────────────────────

/**
 * Sanity-check a steps array at mount. Returns a list of human-readable
 * warnings; the Provider logs these via `console.warn` in development
 * and ignores them in production.
 *
 * Catches the cheap mistakes that would otherwise surface as opaque
 * runtime bugs:
 *
 *   - Duplicate step ids → navigation ambiguity.
 *   - Empty id strings → `stepId === ""` is a valid-looking state that
 *     quietly breaks navigation.
 *   - Steps with no visible content and no annotations → probably a
 *     typo; the user sees an empty card.
 */
export function validateSteps<Meta>(steps: Step<Meta>[]): string[] {
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (!s.id || s.id.trim() === "") {
      warnings.push(`step[${i}] has no id`);
      continue;
    }
    if (seen.has(s.id)) {
      warnings.push(`duplicate step id: "${s.id}"`);
    }
    seen.add(s.id);
    const hasContent = s.title || s.body;
    const hasAnnotations =
      s.annotations?.arrow ||
      (s.annotations?.circles && s.annotations.circles.length > 0) ||
      s.annotations?.spotlight;
    if (!hasContent && !hasAnnotations) {
      warnings.push(`step "${s.id}" has neither content nor annotations`);
    }
  }
  return warnings;
}