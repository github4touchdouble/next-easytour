"use client";

/**
 * @module core/Tutorial
 *
 * The headless provider. Owns internal runtime state (transition
 * flag, target registry) and exposes two React contexts:
 *
 *   1. `TutorialContext` — the public `TutorialApi` snapshot plus
 *      navigation methods. Read via `useTutorial()`.
 *   2. `TargetRegistryContext` — an id → DOM element map populated
 *      by `useTutorialTarget`. Read by layout-aware components
 *      (`Arrow`, `Spotlight`, `Circles`).
 *
 * Design note on the registry: it is built once and never replaced.
 * Tick-style change notifications are delivered to subscribers via a
 * manual listener list rather than by re-creating the context value.
 * This matters because `useTargetRect` uses the registry inside a
 * `useEffect` dep array — if the registry identity changed on every
 * mutation, every registration would re-trigger every effect,
 * producing an infinite update loop under React's strict reconciler.
 */

import * as React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Step, TutorialApi, TutorialProps } from "../types";
import {
  computeClose,
  computeGoto,
  computeNext,
  computePrev,
  computeSnapshot,
  validateSteps,
} from "./state";

// ────────────────────────────────────────────────────────────────────────
// Contexts
// ────────────────────────────────────────────────────────────────────────

const TutorialContext = createContext<TutorialApi<unknown> | null>(null);

/**
 * Target registry API. Exposed to `useTargetRect` and
 * `useTutorialTarget`. The object's identity is stable for the
 * lifetime of the provider — internal mutations do NOT allocate a
 * new registry.
 *
 * `subscribe` follows the `useSyncExternalStore` contract: consumers
 * pass a callback, receive an unsubscribe function, and are invoked
 * synchronously whenever a registration changes. `getVersion` lets
 * them observe the current tick without subscribing.
 */
export interface TargetRegistry {
  register: (id: string, el: Element | null) => void;
  get: (id: string) => Element | null;
  subscribe: (onChange: () => void) => () => void;
  getVersion: () => number;
}

const TargetRegistryContext = createContext<TargetRegistry | null>(null);

// ────────────────────────────────────────────────────────────────────────
// Hooks for consumers
// ────────────────────────────────────────────────────────────────────────

/**
 * Read the current tutorial state and navigate programmatically.
 * Must be called from a descendant of `<Tutorial>`.
 *
 * @throws If called outside a `<Tutorial>` provider.
 */
export function useTutorial<Meta = unknown>(): TutorialApi<Meta> {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error(
      "[next-easytour] useTutorial() called outside <Tutorial>. " +
        "Wrap your tour UI in <Tutorial steps={…} stepId={…} onStepChange={…}>.",
    );
  }
  return ctx as TutorialApi<Meta>;
}

/** Internal: read the target registry. */
export function useTargetRegistry(): TargetRegistry | null {
  return useContext(TargetRegistryContext);
}

/**
 * Internal: subscribe to the registry's change tick. Returns a number
 * that bumps every time a target mounts or unmounts. Used by
 * `useTargetRect` to re-read rects without re-creating the registry
 * context on every change.
 */
export function useRegistryVersion(registry: TargetRegistry | null): number {
  return useSyncExternalStore(
    (onChange) => (registry ? registry.subscribe(onChange) : () => {}),
    () => (registry ? registry.getVersion() : 0),
    () => 0,
  );
}

// ────────────────────────────────────────────────────────────────────────
// Provider
// ────────────────────────────────────────────────────────────────────────

export function Tutorial<Meta = never>(props: TutorialProps<Meta>) {
  const {
    steps,
    stepId,
    onStepChange,
    onOpen,
    onClose,
    onStepEnter,
    onStepLeave,
    canAdvance: canAdvanceProp,
    children,
  } = props;

  // ── Validation (dev-only) ─────────────────────────────────────────────
  const validatedRef = useRef(false);
  if (
    !validatedRef.current &&
    typeof process !== "undefined" &&
    process.env?.NODE_ENV !== "production"
  ) {
    validatedRef.current = true;
    const warnings = validateSteps(steps);
    for (const w of warnings) {
      // eslint-disable-next-line no-console
      console.warn(`[next-easytour] ${w}`);
    }
  }

  // ── Transition flag ───────────────────────────────────────────────────
  const [transitioning, setTransitioning] = useState(false);
  const prevStepIdRef = useRef<string | null>(stepId);

  useEffect(() => {
    const prev = prevStepIdRef.current;
    prevStepIdRef.current = stepId;
    if (prev !== null && stepId !== null && prev !== stepId) {
      setTransitioning(true);
      const t = setTimeout(() => setTransitioning(false), 80);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [stepId]);

  // ── canAdvance evaluation ─────────────────────────────────────────────
  const activeIndex = useMemo(
    () => (stepId === null ? -1 : steps.findIndex((s) => s.id === stepId)),
    [steps, stepId],
  );
  const activeStep = activeIndex >= 0 ? steps[activeIndex] : null;

  const canAdvance = useMemo(() => {
    if (!activeStep) return true;
    if (canAdvanceProp === undefined) return true;
    try {
      return canAdvanceProp(activeStep, activeIndex);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[next-easytour] canAdvance predicate threw:", err);
      return true;
    }
  }, [activeStep, activeIndex, canAdvanceProp]);

  // ── Lifecycle firing ──────────────────────────────────────────────────
  const prevActiveRef = useRef<{ step: Step<Meta> | null; index: number }>({
    step: null,
    index: -1,
  });

  useEffect(() => {
    const prev = prevActiveRef.current;
    const curr = { step: activeStep, index: activeIndex };

    const prevId = prev.step?.id ?? null;
    const currId = curr.step?.id ?? null;

    if (prevId === currId) {
      prevActiveRef.current = curr;
      return;
    }

    const opening = prevId === null && currId !== null;
    const closing = prevId !== null && currId === null;

    if (prev.step) {
      try {
        onStepLeave?.(prev.step, prev.index);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[next-easytour] onStepLeave threw:", err);
      }
    }

    if (opening) {
      try {
        onOpen?.();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[next-easytour] onOpen threw:", err);
      }
    }

    if (curr.step) {
      try {
        onStepEnter?.(curr.step, curr.index);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[next-easytour] onStepEnter threw:", err);
      }
    }

    if (closing) {
      try {
        onClose?.();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[next-easytour] onClose threw:", err);
      }
    }

    prevActiveRef.current = curr;
  }, [activeStep, activeIndex, onOpen, onClose, onStepEnter, onStepLeave]);

  // ── Navigation methods ────────────────────────────────────────────────
  const navInput = useMemo(
    () => ({ steps, stepId, canAdvance }),
    [steps, stepId, canAdvance],
  );

  const next = useCallback(() => {
    const intent = computeNext<Meta>(navInput);
    if (!intent) return;
    onStepChange(intent.toId);
  }, [navInput, onStepChange]);

  const prev = useCallback(() => {
    const intent = computePrev<Meta>(navInput);
    if (!intent) return;
    onStepChange(intent.toId);
  }, [navInput, onStepChange]);

  const goto = useCallback(
    (id: string) => {
      const intent = computeGoto<Meta>(navInput, id);
      if (!intent) return;
      onStepChange(intent.toId);
    },
    [navInput, onStepChange],
  );

  const close = useCallback(() => {
    const intent = computeClose<Meta>(navInput);
    if (!intent) return;
    onStepChange(intent.toId);
  }, [navInput, onStepChange]);

  // ── Target registry (stable identity) ─────────────────────────────────
  //
  // The registry lives entirely in refs; its shape is built once via
  // `useMemo(..., [])` and never re-created. Change notifications are
  // pushed to subscribers via a listener list. This is the pattern
  // `useSyncExternalStore` is designed for: external mutable state,
  // stable subscribe function, stable snapshot function.
  //
  // Previously we stored the tick in React state and rebuilt the
  // registry object in a `useMemo` keyed by it. Every registration
  // bumped the tick → rebuilt the registry → every consumer reading
  // the registry through context re-ran its effects → if those
  // effects touched target state, infinite loop under concurrent
  // React / test-library re-renders. The ref-and-listener pattern
  // side-steps this entirely.
  const targetsMapRef = useRef<Map<string, Element>>(new Map());
  const versionRef = useRef(0);
  const listenersRef = useRef<Set<() => void>>(new Set());

  const registry = useMemo<TargetRegistry>(
    () => ({
      register: (id, el) => {
        const map = targetsMapRef.current;
        const current = map.get(id);
        if (el === current) return; // no-op re-registration
        if (el) {
          map.set(id, el);
        } else {
          map.delete(id);
        }
        versionRef.current += 1;
        // Notify after mutation so subscribers read the new state.
        listenersRef.current.forEach((fn) => fn());
      },
      get: (id) => targetsMapRef.current.get(id) ?? null,
      subscribe: (onChange) => {
        listenersRef.current.add(onChange);
        return () => {
          listenersRef.current.delete(onChange);
        };
      },
      getVersion: () => versionRef.current,
    }),
    [],
  );

  // ── Assemble the public API ───────────────────────────────────────────
  const snapshot = useMemo(
    () =>
      computeSnapshot<Meta>({
        steps,
        stepId,
        transitioning,
        canAdvance,
      }),
    [steps, stepId, transitioning, canAdvance],
  );

  const api = useMemo<TutorialApi<Meta>>(
    () => ({
      ...snapshot,
      next,
      prev,
      goto,
      close,
    }),
    [snapshot, next, prev, goto, close],
  );

  return (
    <TargetRegistryContext.Provider value={registry}>
      <TutorialContext.Provider value={api as TutorialApi<unknown>}>
        {children}
      </TutorialContext.Provider>
    </TargetRegistryContext.Provider>
  );
}