"use client";

/**
 * @module data/useTutorialSteps
 *
 * Loads a `TutorialStore` into React state: `{ steps, trigger, loading,
 * error, reload }`.
 *
 * Aborts in flight on unmount and ignores results from a superseded
 * store, so a fast `reload()` after Save cannot resurrect stale steps —
 * the exact race hosts hit when they hand-rolled the fetch.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { TutorialStore } from "./stores";
import type { Step, TriggerConfig } from "../types";

export interface TutorialStepsState<Meta = never> {
  steps: Step<Meta>[];
  trigger?: TriggerConfig;
  loading: boolean;
  error: Error | null;
  /** Re-read from the store. Call after a save to pick up the new file. */
  reload: () => void;
}

export function useTutorialSteps<Meta = never>(
  store: TutorialStore<Meta> | undefined,
): TutorialStepsState<Meta> {
  const [steps, setSteps] = useState<Step<Meta>[]>([]);
  const [trigger, setTrigger] = useState<TriggerConfig | undefined>(undefined);
  const [loading, setLoading] = useState(() => Boolean(store?.load));
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);

  // Monotonic id: only the newest load may commit to state.
  const runIdRef = useRef(0);

  useEffect(() => {
    if (!store?.load) {
      setLoading(false);
      return;
    }
    const runId = ++runIdRef.current;
    const controller = new AbortController();
    setLoading(true);

    store
      .load(controller.signal)
      .then((result) => {
        if (runId !== runIdRef.current) return;
        setSteps(result.steps);
        setTrigger(result.trigger);
        setError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (runId !== runIdRef.current) return;
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      });

    return () => controller.abort();
  }, [store, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { steps, trigger, loading, error, reload };
}
