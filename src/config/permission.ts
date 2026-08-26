"use client";

/**
 * @module config/permission
 *
 * Editor permission model (0.4).
 *
 * Replaces the 0.3 `CanEdit` union — which accepted a *hook* as a prop
 * (`{ useCanEdit }`) and called it conditionally — with a plain,
 * declarative rule evaluated by a single hook that always runs the same
 * number of hooks.
 *
 * The model separates two independent questions:
 *
 *   1. **May this user edit at all?** (`allow`) — the host answers this
 *      with its own auth. It passes a plain boolean; the library never
 *      calls host hooks.
 *   2. **Does the user want to be editing right now?** (`unlock`) — an
 *      explicit gesture, so authoring chrome never ambushes an admin who
 *      just wanted to read the tour.
 *
 * `"dev-only"` keeps the old NODE_ENV behaviour available, but it is no
 * longer the silent default: an unset permission means "never".
 *
 * Above both questions sits a rule with no override: **the editor does
 * not run in a production build.** See `resolveAllow`.
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ───────────────────────────────────────────────────────────────

/** Base grant: who is *allowed* to edit, before any unlock gesture. */
export type EditorAllow = boolean | "dev-only";

export interface EditorPermissionRule {
  /**
   * Who may edit. Pass a plain boolean computed by your own auth at the
   * call site (`allow: isAdmin`). Default `false`.
   */
  allow?: EditorAllow;
  /**
   * Require an explicit unlock gesture before authoring chrome appears.
   * Default `true` — an allowed user still has to ask for the editor.
   */
  requireUnlock?: boolean;
  /**
   * URL search param that unlocks, e.g. `"edit"` matches `?edit=1`.
   * `false` disables param unlocking. Default `"edit"`.
   */
  unlockParam?: string | false;
  /**
   * Key chord that toggles the unlock, e.g. `"mod+shift+e"` (`mod` is
   * Cmd on macOS, Ctrl elsewhere). `false` disables. Default
   * `"mod+shift+e"`.
   */
  unlockKey?: string | false;
  /**
   * sessionStorage key that remembers the unlock across navigations.
   * `false` disables persistence. Default `"eto:editor-unlocked"`.
   */
  persistUnlock?: string | false;
}

/**
 * Shorthands:
 *   - `false` / `"never"` — editing is off (the default).
 *   - `true` / `"always"` — allowed, and unlocked immediately.
 *   - `"dev-only"`        — allowed outside production, unlock still required.
 */
export type EditorPermission =
  | boolean
  | "never"
  | "always"
  | "dev-only"
  | EditorPermissionRule;

export interface EditorPermissionState {
  /** The user is permitted to edit (auth passed). */
  allowed: boolean;
  /** The user has performed the unlock gesture (or none was required). */
  unlocked: boolean;
  /** `allowed && unlocked` — authoring chrome should render. */
  active: boolean;
  /** Whether an unlock gesture is needed at all. */
  requiresUnlock: boolean;
  unlock: () => void;
  lock: () => void;
  toggle: () => void;
}

// ── Rule normalisation ──────────────────────────────────────────────────

const DEFAULT_RULE: Required<EditorPermissionRule> = {
  allow: false,
  requireUnlock: true,
  unlockParam: "edit",
  unlockKey: "mod+shift+e",
  persistUnlock: "eto:editor-unlocked",
};

/** Expand any `EditorPermission` shorthand into a full rule. */
export function normalizePermission(
  permission: EditorPermission | undefined,
): Required<EditorPermissionRule> {
  if (permission === undefined || permission === false || permission === "never") {
    return { ...DEFAULT_RULE, allow: false };
  }
  if (permission === true || permission === "always") {
    return { ...DEFAULT_RULE, allow: true, requireUnlock: false };
  }
  if (permission === "dev-only") {
    return { ...DEFAULT_RULE, allow: "dev-only" };
  }
  return { ...DEFAULT_RULE, ...permission };
}

/**
 * Whether this is a production build.
 *
 * Bundlers replace `process.env.NODE_ENV` with a literal, so this folds
 * to a constant and the editor's code paths are unreachable in a
 * production bundle.
 */
export function isProductionBuild(): boolean {
  return typeof process !== "undefined" && process.env?.NODE_ENV === "production";
}

let warnedInProduction = false;

/**
 * Complain once if a host explicitly enabled editing in a production
 * build. The request is denied either way; staying silent about it would
 * turn a misconfiguration into a mystery.
 */
function warnProductionDenied() {
  if (warnedInProduction) return;
  warnedInProduction = true;
  // eslint-disable-next-line no-console
  console.warn(
    "[next-easytour] The tutorial editor is disabled in production builds " +
      "and cannot be enabled. `allow` / `canEdit` are ignored here. " +
      "Author tutorials in development and deploy the resulting JSON.",
  );
}

/**
 * Resolve the base grant. Pure — no DOM, no hooks.
 *
 * **The editor is unconditionally off in production.** Not a default, not
 * a strong hint: there is no argument to this function, and no config
 * anywhere in the library, that turns it back on. Authoring is a
 * development-time activity, and a tour editor reachable by an end user
 * is a way to hand out write access to your content by accident.
 */
export function resolveAllow(allow: EditorAllow): boolean {
  if (isProductionBuild()) {
    if (allow === true) warnProductionDenied();
    return false;
  }
  if (allow === "dev-only") return true;
  return allow === true;
}

// ── Key chord matching ──────────────────────────────────────────────────

/**
 * Match a `KeyboardEvent` against a chord string like `"mod+shift+e"`.
 * `mod` is Meta on macOS-ish platforms and Ctrl elsewhere; `ctrl`,
 * `meta`, `shift` and `alt` are matched literally.
 */
export function matchesChord(e: KeyboardEvent, chord: string): boolean {
  const parts = chord.toLowerCase().split("+").map((p) => p.trim()).filter(Boolean);
  const key = parts[parts.length - 1];
  if (!key) return false;
  if (e.key.toLowerCase() !== key && e.code.toLowerCase() !== `key${key}`) return false;

  const isMac =
    typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);
  const wantMod = parts.includes("mod");
  const wantCtrl = parts.includes("ctrl") || (wantMod && !isMac);
  const wantMeta = parts.includes("meta") || parts.includes("cmd") || (wantMod && isMac);

  return (
    e.ctrlKey === wantCtrl &&
    e.metaKey === wantMeta &&
    e.shiftKey === parts.includes("shift") &&
    e.altKey === parts.includes("alt")
  );
}

// ── Hook ────────────────────────────────────────────────────────────────

function readUnlockParam(param: string | false): boolean {
  if (param === false || typeof window === "undefined") return false;
  const value = new URLSearchParams(window.location.search).get(param);
  return value !== null && value !== "0" && value !== "false";
}

function readPersisted(key: string | false): boolean {
  if (key === false || typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writePersisted(key: string | false, on: boolean) {
  if (key === false || typeof window === "undefined") return;
  try {
    if (on) window.sessionStorage.setItem(key, "1");
    else window.sessionStorage.removeItem(key);
  } catch {
    /* storage disabled (private mode, quota) — unlock is session-only */
  }
}

/**
 * Resolve an `EditorPermission` into live state.
 *
 * Always calls the same hooks in the same order regardless of the shape
 * of `permission` — the 0.3 `useResolveCanEdit` did not, which made a
 * host that swapped `canEdit` shapes crash on re-render.
 */
export function useEditorPermission(
  permission: EditorPermission | undefined,
  /** Overrides `rule.allow`. Lets a static config carry reactive auth. */
  allowOverride?: boolean,
): EditorPermissionState {
  const rule = normalizePermission(permission);

  // The production block comes first and takes no arguments: a truthy
  // `canEdit` from host auth must not be able to reopen it either.
  let allowed: boolean;
  if (isProductionBuild()) {
    if (allowOverride === true) warnProductionDenied();
    allowed = false;
  } else {
    allowed = allowOverride ?? resolveAllow(rule.allow);
  }

  const { requireUnlock, unlockParam, unlockKey, persistUnlock } = rule;

  // Start locked on the server and on first client paint so SSR markup
  // matches; the effect below promotes to unlocked once we can read the
  // URL and sessionStorage.
  const [unlockedState, setUnlockedState] = useState(false);

  useEffect(() => {
    if (!allowed || !requireUnlock) return;
    if (readUnlockParam(unlockParam) || readPersisted(persistUnlock)) {
      setUnlockedState(true);
    }
  }, [allowed, requireUnlock, unlockParam, persistUnlock]);

  const setUnlocked = useCallback(
    (on: boolean) => {
      setUnlockedState(on);
      writePersisted(persistUnlock, on);
    },
    [persistUnlock],
  );

  const unlock = useCallback(() => setUnlocked(true), [setUnlocked]);
  const lock = useCallback(() => setUnlocked(false), [setUnlocked]);

  // Ref so the keydown listener never needs re-binding on state change.
  const unlockedRef = useRef(unlockedState);
  unlockedRef.current = unlockedState;
  const toggle = useCallback(
    () => setUnlocked(!unlockedRef.current),
    [setUnlocked],
  );

  useEffect(() => {
    if (!allowed || !requireUnlock || unlockKey === false) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!matchesChord(e, unlockKey)) return;
      e.preventDefault();
      setUnlocked(!unlockedRef.current);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [allowed, requireUnlock, unlockKey, setUnlocked]);

  const unlocked = requireUnlock ? unlockedState : true;

  return {
    allowed,
    unlocked,
    active: allowed && unlocked,
    requiresUnlock: requireUnlock,
    unlock,
    lock,
    toggle,
  };
}
