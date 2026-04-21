import { useSyncExternalStore } from "react";
import type { CanEdit } from "./types";

/**
 * Resolves a `canEdit` prop value into a concrete boolean on every render.
 *
 * Precedence, from most explicit to least:
 *   1. `canEdit === true`  → always on.
 *   2. `canEdit === false` → always off.
 *   3. `canEdit` is a function `() => boolean` → called on every render.
 *   4. `canEdit` is `{ useCanEdit }` → the embedded hook is called.
 *   5. `canEdit === "auto"` or `undefined` → on in development, off in production.
 *
 * The function and hook-object variants are kept distinct because React's
 * Rules of Hooks forbid calling a hook conditionally or from a plain
 * function. The wrapper object makes the intent unambiguous at the call
 * site.
 */
export function useDebugMode(
  canEdit: CanEdit | undefined,
  legacyDebug: boolean | undefined,
): boolean {
  // Back-compat: the old `debug` prop, if set, short-circuits everything.
  if (legacyDebug !== undefined) return legacyDebug;

  if (canEdit === true) return true;
  if (canEdit === false) return false;

  if (typeof canEdit === "function") {
    // Plain predicate — not a hook. Safe to call unconditionally.
    return canEdit();
  }

  if (canEdit && typeof canEdit === "object" && "useCanEdit" in canEdit) {
    // A user-supplied hook. It is always called from the same call site,
    // so the Rules of Hooks are respected as long as the prop's identity
    // does not change between renders — which is the host's responsibility.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return canEdit.useCanEdit();
  }

  // Default / "auto" — development on, production off.
  return isDevelopment();
}

function isDevelopment(): boolean {
  // `process` is not defined in all environments (e.g. Deno, some edge
  // runtimes). Guard accordingly.
  try {
    return (
      typeof process !== "undefined" &&
      process.env?.NODE_ENV === "development"
    );
  } catch {
    return false;
  }
}

/**
 * Convenience hook: read a boolean flag from `localStorage`, re-render when
 * it changes. Safe on the server (returns `false` during SSR).
 *
 * @example
 *   <TutorialOverlay
 *     {...props}
 *     canEdit={{ useCanEdit: () => useLocalStorageCanEdit() }}
 *   />
 */
export function useLocalStorageCanEdit(
  key = "next-easytour:debug",
): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined") return () => {};
      const listener = (e: StorageEvent) => {
        if (e.key === key) onChange();
      };
      window.addEventListener("storage", listener);
      return () => window.removeEventListener("storage", listener);
    },
    () => {
      if (typeof window === "undefined") return false;
      return window.localStorage.getItem(key) === "true";
    },
    () => false, // SSR snapshot
  );
}