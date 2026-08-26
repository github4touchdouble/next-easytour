"use client";

/**
 * @module core/TutorialProvider
 *
 * Owns everything a tour needs that is not "draw an overlay": which step
 * is open, where steps came from, whether the user finished, whether
 * this user may edit.
 *
 * It renders no DOM. Wrap the page in it, put `<TutorialStage>` wherever
 * the overlays belong, and `<TourTrigger>` wherever the button belongs —
 * they can be far apart in the tree, which is why the state lives up
 * here rather than inside `<Tutorial>`.
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
import type { ResolvedTutorialConfig } from "../config/defineTutorial";
import {
  useEditorPermission,
  type EditorPermissionState,
} from "../config/permission";
import { useTutorialSteps } from "../data/useTutorialSteps";
import type { TutorialStore, TutorialPayload } from "../data/stores";
import { useTutorialDone } from "./useTutorialDone";
import { useEditorChunk, type EditorChunk } from "../editor/useEditorChunk";
import { AppearanceProvider } from "../config/appearance";
import {
  createFeatureRegistry,
  FeatureRegistryProvider,
  useFeatureDescriptors,
  useFeatureSnapshots,
} from "./features";
import type { FeatureDescriptor, Step, TriggerConfig } from "../types";

// ── Public API ──────────────────────────────────────────────────────────

export interface TourApi<Meta = never> {
  /** Steps as loaded from the store (before editor overrides). */
  steps: Step<Meta>[];
  /** The store is still being read. */
  loading: boolean;
  /** The store failed to load. The tour renders nothing. */
  error: Error | null;
  /** Re-read the store. */
  reload: () => void;

  /** Id of the open step, or null when the tour is closed. */
  stepId: string | null;
  isOpen: boolean;
  /** The tour can actually run here — enabled, media matches, has steps. */
  available: boolean;

  /** Open the tour. Defaults to the first step. */
  start: (stepId?: string) => void;
  /** Close the tour. */
  stop: () => void;
  /** Clear completion and open at the first step. */
  restart: () => void;

  /** The user has completed this tour before. */
  done: boolean;
  markDone: () => void;
  resetDone: () => void;

  /** Trigger button config — from the store if saved there, else config. */
  trigger: TriggerConfig;

  /** Editor permission state, including `unlock()` / `lock()`. */
  editor: EditorPermissionState;

  /**
   * Host behaviours a step can invoke, as plain data. Populated by
   * `useTutorialFeature`; drives the editor's feature menu, and lets a
   * host assert in a test that a tour's steps only name features that
   * actually exist.
   */
  features: FeatureDescriptor[];
}

// ── Internal context ────────────────────────────────────────────────────

interface TourInternal<Meta = never> extends TourApi<Meta> {
  /**
   * Reports the tour's entry-point button. `<TourTrigger>` calls this
   * with its element on mount and null on unmount, which lets the editor
   * seam measure the button without wrapping it in extra DOM, and lets
   * the provider warn when a tour has no way in.
   */
  registerTrigger: (el: HTMLElement | null) => void;
  /**
   * The editor's components, once its chunk has loaded — null in
   * production, and until then. Passed down rather than loaded again in
   * `<TutorialStage>`, so the library has exactly one `import()` site to
   * keep out of production builds.
   */
  editorChunk: EditorChunk | null;
  config: ResolvedTutorialConfig<Meta>;
  store: TutorialStore<Meta>;
  setStepId: (id: string | null) => void;
  handleSave: ((steps: Step<Meta>[], trigger?: TriggerConfig) => Promise<void>) | undefined;
  handleSaved: () => void;
  /** Fires when a step is entered, so completion can be recorded. */
  noteStepEnter: (step: Step<Meta>) => void;
}

const TourContext = createContext<TourInternal<never> | null>(null);

export function useTour<Meta = never>(): TourApi<Meta> {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error(
      "[next-easytour] useTour() called outside <TutorialProvider>. " +
        "Wrap the page in <TutorialProvider config={…}>.",
    );
  }
  return ctx as unknown as TourApi<Meta>;
}

/** @internal — used by `<TutorialStage>` and `<TourTrigger>`. */
export function useTourInternal<Meta = never>(): TourInternal<Meta> | null {
  return useContext(TourContext) as unknown as TourInternal<Meta> | null;
}

// ── Media gate ──────────────────────────────────────────────────────────

const NOOP_SUBSCRIBE = () => () => {};

/**
 * `matchMedia` as an external store.
 *
 * The 0.3 pattern was `typeof window !== "undefined" && window.innerWidth
 * >= 768` inline in render, which hydrates wrong and never updates on
 * resize. This reports false during SSR and corrects itself after
 * hydration, which is what `useSyncExternalStore` exists for.
 */
function useMediaMatches(query: string | undefined): boolean {
  const subscribe = useMemo(() => {
    if (!query || typeof window === "undefined" || !window.matchMedia) return NOOP_SUBSCRIBE;
    return (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    };
  }, [query]);

  return useSyncExternalStore(
    subscribe,
    () => {
      if (!query) return true;
      if (typeof window === "undefined" || !window.matchMedia) return true;
      return window.matchMedia(query).matches;
    },
    () => !query,
  );
}

// ── Store identity ──────────────────────────────────────────────────────

/**
 * Keep a stable store instance across renders.
 *
 * `defineTutorial` builds a fresh store object every call, so a host that
 * calls it inside a component would otherwise re-fetch on every render.
 * Stores are identified by `name`; same name means same source.
 */
function useStableStore<Meta>(store: TutorialStore<Meta>): TutorialStore<Meta> {
  const ref = useRef(store);
  if (ref.current !== store && ref.current.name !== store.name) {
    ref.current = store;
  }
  return ref.current;
}

// ── Provider ────────────────────────────────────────────────────────────

export interface TutorialProviderProps<Meta = never> {
  config: ResolvedTutorialConfig<Meta>;
  /**
   * Overrides `config.editor.permission.allow` with a value from your own
   * auth — `canEdit={hasRole("admin")}`.
   *
   * This is the seam that lets `config` stay a static module-scope
   * object while the permission itself stays reactive. The library never
   * calls a host hook to find out.
   */
  canEdit?: boolean;
  /** Called on every step change, including open (id) and close (null). */
  onStepChange?: (stepId: string | null) => void;
  children: React.ReactNode;
}

export function TutorialProvider<Meta = never>(props: TutorialProviderProps<Meta>) {
  const { config, canEdit, onStepChange, children } = props;

  const store = useStableStore(config.store);
  const { steps, trigger: storedTrigger, loading, error, reload } = useTutorialSteps<Meta>(store);

  const [stepId, setStepIdState] = useState<string | null>(null);

  const mediaQuery = config.media ?? (config.minWidth !== undefined ? `(min-width: ${config.minWidth}px)` : undefined);
  const mediaMatches = useMediaMatches(mediaQuery);

  // One registry per provider, so two tours on a page cannot collide.
  const registryRef = useRef(createFeatureRegistry());
  const registry = registryRef.current;

  const restoreOnClose = config.features?.restoreOnClose ?? true;
  const { capture, restore } = useFeatureSnapshots(registry, restoreOnClose);

  const features = useFeatureDescriptors(registry);
  const permission = useEditorPermission(config.editor.permission, canEdit);

  // Loaded on `allowed`, not `active`: fetching it while the editor is
  // still locked means unlocking is instant.
  const editorChunk = useEditorChunk(permission.allowed);

  // ── Completion ──────────────────────────────────────────────────────
  const completion = config.completion;
  const doneState = useTutorialDone(
    completion === false ? `${config.id}-done` : completion.key,
  );
  const { done, markDone, reset: resetDone } = doneState;

  const available = config.enabled && mediaMatches && !error && steps.length > 0;

  // ── Navigation ──────────────────────────────────────────────────────
  // Tracks whether the last step was reached during this run, so
  // markOn: "finish" can tell a completed tour from an abandoned one.
  const reachedLastRef = useRef(false);

  // `setStepId` below is the only writer of `stepId`, so this ref stays
  // in step with the state without being written during render.
  const stepIdRef = useRef<string | null>(null);

  // Latest-value refs keep `setStepId` referentially stable: it is passed
  // to <Tutorial> as `onStepChange`, and a new identity every render
  // would churn every consumer of the context.
  const completionRef = useRef(completion);
  const markDoneRef = useRef(markDone);
  const captureRef = useRef(capture);
  const restoreRef = useRef(restore);
  useEffect(() => {
    completionRef.current = completion;
    markDoneRef.current = markDone;
    captureRef.current = capture;
    restoreRef.current = restore;
  }, [completion, markDone, capture, restore]);

  /**
   * Every way of closing the tour funnels through here — the card's
   * close button, `next()` off the last step, `stop()`, and the media
   * gate — because the provider owns `stepId`.
   *
   * Completion therefore lives here rather than on `<Tutorial onClose>`,
   * which only fires for closes that `<Tutorial>` itself initiates and
   * so missed `stop()` entirely.
   */
  const setStepId = useCallback(
    (id: string | null) => {
      const closing = id === null && stepIdRef.current !== null;
      const opening = id !== null && stepIdRef.current === null;
      stepIdRef.current = id;
      setStepIdState(id);

      if (opening) {
        // Before the first step's actions touch anything.
        captureRef.current();
      }

      if (closing) {
        const c = completionRef.current;
        if (c !== false && c.markOn === "finish" && reachedLastRef.current) {
          markDoneRef.current();
        }
        reachedLastRef.current = false;
        // After completion is recorded, so a restore that throws cannot
        // cost the user their progress.
        restoreRef.current();
      }

      onStepChange?.(id);
    },
    [onStepChange],
  );

  const start = useCallback(
    (id?: string) => {
      const target = id ?? steps[0]?.id;
      if (target === undefined) return;
      setStepId(target);
    },
    [steps, setStepId],
  );

  const stop = useCallback(() => setStepId(null), [setStepId]);

  const restart = useCallback(() => {
    resetDone();
    const first = steps[0]?.id;
    if (first !== undefined) setStepId(first);
  }, [resetDone, steps, setStepId]);

  // Close the tour if the media gate stops matching mid-run (rotate a
  // tablet into portrait) — leaving overlays pinned to a layout that no
  // longer exists is worse than closing.
  useEffect(() => {
    if (!mediaMatches && stepId !== null) setStepId(null);
  }, [mediaMatches, stepId, setStepId]);

  // Drop a stepId that no longer exists after a reload or an editor
  // delete, so the tour never sits open on a missing step.
  useEffect(() => {
    if (stepId === null || loading) return;
    if (!steps.some((s) => s.id === stepId)) setStepId(null);
  }, [steps, stepId, loading, setStepId]);

  // Unmounting mid-tour still owes the user their app back.
  useEffect(() => () => { restoreRef.current(); }, []);

  // ── Auto-start ──────────────────────────────────────────────────────
  const autoStartedRef = useRef(false);
  useEffect(() => {
    const auto = config.autoStart;
    if (!auto || autoStartedRef.current || !available) return;
    if (auto.once && done) return;
    autoStartedRef.current = true;
    if (auto.delay <= 0) {
      start();
      return;
    }
    const t = setTimeout(start, auto.delay);
    return () => clearTimeout(t);
  }, [config.autoStart, available, done, start]);

  // ── Completion recording ────────────────────────────────────────────

  const noteStepEnter = useCallback(
    (step: Step<Meta>) => {
      const lastId = steps[steps.length - 1]?.id;
      if (step.id !== lastId) return;
      reachedLastRef.current = true;
      if (completion !== false && completion.markOn === "last-step") markDone();
    },
    [steps, completion, markDone],
  );

  // ── Saving ──────────────────────────────────────────────────────────
  // Undefined when the store cannot write, which makes <Editor> fall
  // back to copying JSON to the clipboard.
  const handleSave = useMemo(() => {
    if (!store.save) return undefined;
    return async (nextSteps: Step<Meta>[], nextTrigger?: TriggerConfig) => {
      const payload: TutorialPayload<Meta> = {
        steps: nextSteps,
        ...(nextTrigger ?? storedTrigger ? { trigger: nextTrigger ?? storedTrigger } : {}),
        version: 1,
      };
      await store.save!(payload);
    };
  }, [store, storedTrigger]);

  const handleSaved = useCallback(() => {
    if (config.editor.reloadAfterSave) reload();
  }, [config.editor.reloadAfterSave, reload]);

  // ── Entry point ─────────────────────────────────────────────────────
  // The trigger element doubles as the seam's anchor and as evidence
  // that the tour is reachable at all.
  const [triggerEl, setTriggerEl] = useState<HTMLElement | null>(null);
  const registerTrigger = useCallback((el: HTMLElement | null) => {
    setTriggerEl((prev) => (prev === el ? prev : el));
  }, []);

  const entryPoint = config.entryPoint ?? "trigger";
  const warnedNoEntryRef = useRef(false);

  useEffect(() => {
    if (typeof process === "undefined" || process.env?.NODE_ENV === "production") return;
    if (warnedNoEntryRef.current) return;
    // Only meaningful once the tour could actually be shown: before that,
    // <TourTrigger> renders null for legitimate reasons.
    if (!available) return;
    if (entryPoint === "custom" || config.autoStart || triggerEl) return;

    // A <TourTrigger> mounting in this same commit attaches its ref during
    // the layout phase, which schedules the state update *after* this
    // passive effect has already run — so `triggerEl` is still null here
    // even when a trigger exists. Wait a turn before concluding the tour
    // is unreachable; the re-run this causes cancels the timer.
    const timer = setTimeout(() => {
      warnedNoEntryRef.current = true;
      // eslint-disable-next-line no-console
      console.warn(
        `[next-easytour] tutorial "${config.id}" has no entry point: no ` +
          "<TourTrigger> is mounted and `autoStart` is off, so no user can " +
          "open it.\nAdd <TourTrigger /> inside the provider, or set " +
          "autoStart: true, or call start() yourself and set " +
          'entryPoint: "custom" to silence this.',
      );
    }, 0);
    return () => clearTimeout(timer);
  }, [available, entryPoint, config.autoStart, config.id, triggerEl]);

  // A trigger config saved by the editor wins over the one in code —
  // that round-trip was broken in 0.3, where the editor saved a config
  // the button never read.
  const trigger = useMemo<TriggerConfig>(
    () => ({ ...config.trigger, ...storedTrigger }),
    [config.trigger, storedTrigger],
  );

  const value = useMemo<TourInternal<Meta>>(
    () => ({
      steps, loading, error, reload,
      stepId, isOpen: stepId !== null, available,
      start, stop, restart,
      done, markDone, resetDone,
      trigger,
      editor: permission,
      features,
      config, store, setStepId, registerTrigger, editorChunk,
      handleSave, handleSaved, noteStepEnter,
    }),
    [steps, loading, error, reload, stepId, available, start, stop, restart,
     done, markDone, resetDone, trigger, permission, features, config, store, setStepId,
     registerTrigger, editorChunk, handleSave, handleSaved, noteStepEnter],
  );

  return (
    <TourContext.Provider value={value as unknown as TourInternal<never>}>
      <AppearanceProvider classNames={config.classNames}>
        <FeatureRegistryProvider registry={registry}>{children}</FeatureRegistryProvider>
      </AppearanceProvider>
      {/* Lives on the provider, not the stage: the trigger — and so the
          seam — is only on screen while the tour is *closed*, which is
          exactly when the stage renders nothing. Portaled, so the
          provider still contributes no DOM of its own. */}
      {permission.active && editorChunk && (
        <editorChunk.EditorSeam target={triggerEl} />
      )}
    </TourContext.Provider>
  );
}
