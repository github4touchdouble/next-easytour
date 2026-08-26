/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { matchesChord, normalizePermission, resolveAllow } from "../src";

// ────────────────────────────────────────────────────────────────────────
// Shorthand expansion
// ────────────────────────────────────────────────────────────────────────

describe("normalizePermission", () => {
  it("denies by default — an unset permission is not 'dev-only'", () => {
    // The 0.3 default silently enabled the editor for every visitor in
    // development. 0.4 makes that opt-in.
    expect(normalizePermission(undefined).allow).toBe(false);
  });

  it("treats false and 'never' as denial", () => {
    expect(normalizePermission(false).allow).toBe(false);
    expect(normalizePermission("never").allow).toBe(false);
  });

  it("treats true and 'always' as allowed with no unlock gesture", () => {
    for (const p of [true, "always"] as const) {
      expect(normalizePermission(p)).toMatchObject({ allow: true, requireUnlock: false });
    }
  });

  it("keeps the unlock requirement for 'dev-only'", () => {
    expect(normalizePermission("dev-only")).toMatchObject({
      allow: "dev-only",
      requireUnlock: true,
    });
  });

  it("fills defaults around a partial rule", () => {
    expect(normalizePermission({ allow: true })).toEqual({
      allow: true,
      requireUnlock: true,
      unlockParam: "edit",
      unlockKey: "mod+shift+e",
      persistUnlock: "eto:editor-unlocked",
    });
  });

  it("lets a rule opt out of every unlock channel", () => {
    expect(normalizePermission({
      allow: true, unlockParam: false, unlockKey: false, persistUnlock: false,
    })).toMatchObject({ unlockParam: false, unlockKey: false, persistUnlock: false });
  });
});

// ────────────────────────────────────────────────────────────────────────
// Base grant
// ────────────────────────────────────────────────────────────────────────

describe("resolveAllow", () => {
  it("passes booleans through", () => {
    expect(resolveAllow(true)).toBe(true);
    expect(resolveAllow(false)).toBe(false);
  });

  it("resolves 'dev-only' against NODE_ENV", () => {
    // Vitest runs with NODE_ENV=test, which is not production.
    expect(resolveAllow("dev-only")).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────
// Key chords
// ────────────────────────────────────────────────────────────────────────

function key(init: Partial<KeyboardEvent> & { key: string }): KeyboardEvent {
  return {
    key: init.key,
    code: init.code ?? `Key${init.key.toUpperCase()}`,
    ctrlKey: init.ctrlKey ?? false,
    metaKey: init.metaKey ?? false,
    shiftKey: init.shiftKey ?? false,
    altKey: init.altKey ?? false,
  } as KeyboardEvent;
}

describe("matchesChord", () => {
  it("matches an exact modifier set", () => {
    expect(matchesChord(key({ key: "e", ctrlKey: true, shiftKey: true }), "ctrl+shift+e"))
      .toBe(true);
  });

  it("rejects a superset of modifiers", () => {
    // Ctrl+Shift+Alt+E must not fire a Ctrl+Shift+E binding, or the
    // chord would collide with other apps' shortcuts.
    expect(matchesChord(key({ key: "e", ctrlKey: true, shiftKey: true, altKey: true }), "ctrl+shift+e"))
      .toBe(false);
  });

  it("rejects a subset of modifiers", () => {
    expect(matchesChord(key({ key: "e", ctrlKey: true }), "ctrl+shift+e")).toBe(false);
  });

  it("rejects the wrong key", () => {
    expect(matchesChord(key({ key: "f", ctrlKey: true, shiftKey: true }), "ctrl+shift+e"))
      .toBe(false);
  });

  it("is case-insensitive on both the event and the chord", () => {
    expect(matchesChord(key({ key: "E", ctrlKey: true }), "CTRL+E")).toBe(true);
  });

  it("maps `mod` to Ctrl on a non-Apple platform", () => {
    // jsdom reports a Linux-ish platform, so `mod` means Ctrl here.
    expect(matchesChord(key({ key: "e", ctrlKey: true, shiftKey: true }), "mod+shift+e"))
      .toBe(true);
    expect(matchesChord(key({ key: "e", metaKey: true, shiftKey: true }), "mod+shift+e"))
      .toBe(false);
  });

  it("falls back to event.code when event.key is a dead or composed key", () => {
    expect(matchesChord(key({ key: "Dead", code: "KeyE", ctrlKey: true }), "ctrl+e"))
      .toBe(true);
  });

  it("rejects an empty chord instead of matching everything", () => {
    expect(matchesChord(key({ key: "e" }), "")).toBe(false);
  });
});
