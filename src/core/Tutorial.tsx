"use client";

/**
 * @module core/Tutorial
 *
 * The headless provider. Alpha.3 additions:
 *
 *   - CSS-selector targeting alongside hook-based `useTutorialTarget`.
 *   - Auto-scroll targets into view on step enter.
 *   - Step action execution via `useStepActions`.
 *   - WaitFor condition evaluation via `useWaitFor`.
 *   - Auto-advance timer (fires after waitFor if both present).
 *   - Highlight ring around active target via `useHighlight`.
 *   - `getTargetElement()` on the API for host-side element access.
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
import { CardRectContext } from "../overlay/Arrow";
import type { Rect } from "./useTargetRect";
import { useStepActions } from "./useStepActions";
import { useWaitFor } from "./useWaitFor";
import { useHighlight } from "./useHighlight";

// ── Contexts ────────────────────────────────────────────────────────────

const TutorialContext = createContext<TutorialApi<unknown> | null>(null);

export interface TargetRegistry {
  register: (id: string, el: Element | null) => void;
  get: (id: string) => Element | null;
  subscribe: (onChange: () => void) => () => void;
  getVersion: () => number;
}

const TargetRegistryContext = createContext<TargetRegistry | null>(null);

// ── Hooks ───────────────────────────────────────────────────────────────

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

export function useTargetRegistry(): TargetRegistry | null {
  return useContext(TargetRegistryContext);
}

export function useRegistryVersion(registry: TargetRegistry | null): number {
  return useSyncExternalStore(
    (onChange) => (registry ? registry.subscribe(onChange) : () => {}),
    () => (registry ? registry.getVersion() : 0),
    () => 0,
  );
}

// ── Provider ────────────────────────────────────────────────────────────

export function Tutorial<Meta = never>(props: TutorialProps<Meta>) {
  const {
    steps,
    stepId,
    onStepChange,
    onOpen,
    onClose,
    onStepEnter,
    onStepLeave,
    onWaitComplete,
    canAdvance: canAdvanceProp,
    transition: globalTransition,
    scrollIntoView: globalScrollIntoView,
    defaultCardAnchor,
    cardPositioning: cardPositioningProp,
    theme,
    children,
  } = props;

  const cardPositioning = cardPositioningProp ?? "fixed";

  // ── Theme injection ─────────────────────────────────────────────────
  // Sets CSS custom properties on :root so portaled overlays inherit them.
  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    const mapping: Record<string, string> = {
      accent: "--eto-accent",
      surface: "--eto-surface",
      fg: "--eto-fg",
      muted: "--eto-muted",
      mutedSoft: "--eto-muted-soft",
      hoverBg: "--eto-hover-bg",
      border: "--eto-border",
      borderSoft: "--eto-border-soft",
      arrowColor: "--eto-arrow",
      arrowOpacity: "--eto-arrow-opacity",
      cardWidth: "--eto-card-width",
      cardRadius: "--eto-card-radius",
    };
    const applied: string[] = [];
    for (const [key, cssVar] of Object.entries(mapping)) {
      const val = (theme as Record<string, string | undefined>)[key];
      if (val !== undefined) {
        root.style.setProperty(cssVar, val);
        applied.push(cssVar);
      }
    }
    return () => {
      // Clean up: remove only the vars we set
      for (const cssVar of applied) {
        root.style.removeProperty(cssVar);
      }
    };
  }, [theme]);

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
      const dur = globalTransition?.duration ?? 200;
      const t = setTimeout(() => setTransitioning(false), Math.min(dur, 200));
      return () => clearTimeout(t);
    }
    return undefined;
  }, [stepId, globalTransition?.duration]);

  // ── Active step computation ───────────────────────────────────────────
  const activeIndex = useMemo(
    () => (stepId === null ? -1 : steps.findIndex((s) => s.id === stepId)),
    [steps, stepId],
  );
  const activeStep = activeIndex >= 0 ? steps[activeIndex] : null;

  // ── canAdvance evaluation ─────────────────────────────────────────────
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

  // ── Target registry (stable identity) ─────────────────────────────────
  const targetsMapRef = useRef<Map<string, Element>>(new Map());
  const versionRef = useRef(0);
  const listenersRef = useRef<Set<() => void>>(new Set());

  const registry = useMemo<TargetRegistry>(
    () => ({
      register: (id, el) => {
        const map = targetsMapRef.current;
        const current = map.get(id);
        if (el === current) return;
        if (el) map.set(id, el);
        else map.delete(id);
        versionRef.current += 1;
        listenersRef.current.forEach((fn) => fn());
      },
      get: (id) => targetsMapRef.current.get(id) ?? null,
      subscribe: (onChange) => {
        listenersRef.current.add(onChange);
        return () => { listenersRef.current.delete(onChange); };
      },
      getVersion: () => versionRef.current,
    }),
    [],
  );

  // ── getTargetElement: registry → selector fallback ────────────────────
  const getTargetElement = useCallback(
    (targetIdOrSelector?: string): Element | null => {
      if (!targetIdOrSelector) {
        // Try the active step's primary target, then selector
        if (activeStep?.targets?.[0]) {
          const el = registry.get(activeStep.targets[0]);
          if (el) return el;
        }
        if (activeStep?.selector) {
          return document.querySelector(activeStep.selector);
        }
        return null;
      }
      // Try hook registry first
      const fromReg = registry.get(targetIdOrSelector);
      if (fromReg) return fromReg;
      // Try as CSS selector
      try {
        return document.querySelector(targetIdOrSelector);
      } catch {
        return null;
      }
    },
    [registry, activeStep],
  );

  // ── CSS selector registration ─────────────────────────────────────────
  // When a step has `selector` but no hook-registered target, we register
  // the matched element into the registry so all overlay components
  // (Arrow, Spotlight, Circles) work without modification.
  useEffect(() => {
    if (!activeStep?.selector) return;
    // Use the selector string as the target ID if no explicit targets
    const selectorId = activeStep.selector;
    const alreadyRegistered = registry.get(selectorId);
    if (alreadyRegistered) return;

    const el = document.querySelector(activeStep.selector);
    if (el) {
      registry.register(selectorId, el);
      return () => { registry.register(selectorId, null); };
    }
    return undefined;
  }, [activeStep?.id, activeStep?.selector, registry]);

  // ── Auto-scroll ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeStep) return;
    const scrollOpt = activeStep.scrollIntoView ?? globalScrollIntoView;
    if (!scrollOpt) return;

    // Small delay so CSS-selector registration settles
    const t = setTimeout(() => {
      const el = getTargetElement();
      if (!el) return;

      if (scrollOpt === true) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        el.scrollIntoView(scrollOpt);
      }
    }, 50);

    return () => clearTimeout(t);
  }, [activeStep?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step actions ──────────────────────────────────────────────────────
  useStepActions(
    activeStep as Step<never> | null,
    getTargetElement,
  );

  // ── WaitFor ───────────────────────────────────────────────────────────
  const waitSatisfied = useWaitFor(
    activeStep as Step<never> | null,
    getTargetElement,
  );
  const isWaiting = activeStep?.waitFor ? !waitSatisfied : false;

  // Fire onWaitComplete when wait transitions from pending to satisfied
  const prevWaitRef = useRef(false);
  useEffect(() => {
    if (prevWaitRef.current && !isWaiting && activeStep) {
      try { onWaitComplete?.(activeStep, activeIndex); } catch { /* */ }
    }
    prevWaitRef.current = isWaiting;
  }, [isWaiting, activeStep, activeIndex, onWaitComplete]);

  // ── Auto-advance ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeStep?.autoAdvance) return;
    if (isWaiting) return; // Wait for waitFor first

    const t = setTimeout(() => {
      const nextIdx = activeIndex + 1;
      if (nextIdx < steps.length) {
        onStepChange(steps[nextIdx].id);
      } else {
        onStepChange(null); // Close
      }
    }, activeStep.autoAdvance);

    return () => clearTimeout(t);
  }, [activeStep?.id, activeStep?.autoAdvance, isWaiting, activeIndex, steps, onStepChange]);

  // ── Highlight ─────────────────────────────────────────────────────────
  useHighlight(
    activeStep as Step<never> | null,
    getTargetElement,
  );

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
      try { onStepLeave?.(prev.step, prev.index); } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[next-easytour] onStepLeave threw:", err);
      }
    }

    if (opening) {
      try { onOpen?.(); } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[next-easytour] onOpen threw:", err);
      }
    }

    if (curr.step) {
      try { onStepEnter?.(curr.step, curr.index); } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[next-easytour] onStepEnter threw:", err);
      }
    }

    if (closing) {
      try { onClose?.(); } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[next-easytour] onClose threw:", err);
      }
    }

    prevActiveRef.current = curr;
  }, [activeStep, activeIndex, onOpen, onClose, onStepEnter, onStepLeave]);

  // ── Navigation methods ────────────────────────────────────────────────
  const effectiveCanAdvance = canAdvance && !isWaiting;

  const navInput = useMemo(
    () => ({ steps, stepId, canAdvance: effectiveCanAdvance }),
    [steps, stepId, effectiveCanAdvance],
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

  // ── Assemble the public API ───────────────────────────────────────────
  const snapshot = useMemo(
    () =>
      computeSnapshot<Meta>({
        steps,
        stepId,
        transitioning,
        canAdvance,
        isWaiting,
      }),
    [steps, stepId, transitioning, canAdvance, isWaiting],
  );

  const api = useMemo<TutorialApi<Meta>>(
    () => ({
      ...snapshot,
      steps,
      next,
      prev,
      goto,
      close,
      getTargetElement,
      defaultCardAnchor,
      cardPositioning,
    }),
    [snapshot, steps, next, prev, goto, close, getTargetElement, defaultCardAnchor, cardPositioning],
  );

  // ── Card rect store ───────────────────────────────────────────────────
  const [cardRect, setCardRect] = useState<Rect | null>(null);
  const cardRectStore = useMemo(
    () => ({ rect: cardRect, setRect: setCardRect }),
    [cardRect],
  );

  return (
    <TargetRegistryContext.Provider value={registry}>
      <TutorialContext.Provider value={api as TutorialApi<unknown>}>
        <CardRectContext.Provider value={cardRectStore}>
          {children}
        </CardRectContext.Provider>
      </TutorialContext.Provider>
    </TargetRegistryContext.Provider>
  );
}