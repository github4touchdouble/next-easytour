"use client";

/**
 * @module core/useTutorialDone
 *
 * Tracks whether the user has completed the tutorial. Persists
 * across sessions via a cookie (1-year expiry). Returns `done`
 * state, `markDone()`, and `reset()`.
 *
 * Usage:
 * ```tsx
 * const { done, markDone } = useTutorialDone("my-tutorial");
 * <TriggerButton done={done} ... />
 * <Tutorial onClose={() => { if (reachedLast) markDone(); }} ... />
 * ```
 */

import { useCallback, useState } from "react";

function readCookie(key: string): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((c) => c.startsWith(`${key}=`));
}

function setCookie(key: string, value: string, maxAge: number = 31536000) {
  if (typeof document === "undefined") return;
  document.cookie = `${key}=${value}; max-age=${maxAge}; path=/; SameSite=Lax`;
}

function deleteCookie(key: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${key}=; max-age=0; path=/; SameSite=Lax`;
}

export interface TutorialDoneState {
  /** Whether the tutorial has been completed. */
  done: boolean;
  /** Mark the tutorial as completed. Writes the cookie. */
  markDone: () => void;
  /** Reset the completion state. Deletes the cookie. */
  reset: () => void;
}

/**
 * @param cookieKey — cookie name. Default "easytour_done".
 *   MuTopia uses "mutopia_tutorial_done".
 */
export function useTutorialDone(cookieKey: string = "easytour_done"): TutorialDoneState {
  const [done, setDone] = useState(() => readCookie(cookieKey));

  const markDone = useCallback(() => {
    setCookie(cookieKey, "1");
    setDone(true);
  }, [cookieKey]);

  const reset = useCallback(() => {
    deleteCookie(cookieKey);
    setDone(false);
  }, [cookieKey]);

  return { done, markDone, reset };
}