"use client";

/**
 * @module editor/useEditorChunk
 *
 * Loads the editor chunk on demand, and never at all in production.
 *
 * The whole point is `EDITOR_ENABLED`. It is written as a bare
 * `process.env.NODE_ENV` comparison because that is the expression every
 * bundler substitutes with a literal, which turns the guard below into
 * `if (false)` and lets the `import()` — and therefore the entire editor
 * chunk — be dropped from a production build.
 *
 * That is why the constant is defined here rather than imported from
 * `config/permission`: cross-module constant folding is not something
 * bundlers do reliably, so the comparison has to sit in the same file as
 * the branch it controls.
 */

import { useEffect, useState } from "react";

/**
 * False in a production build.
 *
 * Written as three plain `&&` operands, all side-effect free, so a
 * minifier can evaluate the lot:
 *
 *   - `typeof process` covers pure-browser environments where nothing was
 *     substituted and `process` genuinely does not exist.
 *   - `typeof process.env` covers runtimes that expose `process` without
 *     an `env`. This is what the optional chaining used elsewhere in the
 *     library buys, spelled out — `process.env?.NODE_ENV` is not the
 *     expression bundlers substitute, so it would never fold.
 *   - `process.env.NODE_ENV` is the exact expression every bundler
 *     replaces with a literal, which collapses the whole chain to
 *     `false` and lets the `import()` below be dropped entirely.
 *
 * Deliberately not exported: an exported binding can be read from
 * outside, which stops a minifier inlining it. Use `isProductionBuild()`
 * from `config/permission` if you need the value at runtime.
 */
const EDITOR_ENABLED: boolean =
  typeof process !== "undefined" &&
  typeof process.env !== "undefined" &&
  process.env.NODE_ENV !== "production";

export type EditorChunk = typeof import("./chrome");

// Module-level cache: the provider and any other caller share one load,
// and a remount does not re-await a chunk that already arrived.
let cached: EditorChunk | null = null;
let pending: Promise<EditorChunk> | null = null;
let failed = false;

/**
 * @param enabled Whether this user may edit *at all* — not whether they
 *   have unlocked the editor. Loading on `allowed` rather than `active`
 *   means the chunk is already in memory by the time an author presses
 *   the unlock chord, so the editor appears instantly instead of after a
 *   network round trip.
 */
export function useEditorChunk(enabled: boolean): EditorChunk | null {
  const [chunk, setChunk] = useState<EditorChunk | null>(cached);

  useEffect(() => {
    // Folds to `if (false)` in production, taking the import() with it.
    if (!EDITOR_ENABLED) return;
    if (!enabled || cached !== null || failed) return;

    let cancelled = false;
    pending ??= import("./chrome");
    pending
      .then((mod) => {
        cached = mod;
        if (!cancelled) setChunk(mod);
      })
      .catch((err: unknown) => {
        // A failed chunk load must not take the tour down with it: the
        // tour still renders for readers, only authoring is unavailable.
        failed = true;
        pending = null;
        // eslint-disable-next-line no-console
        console.error("[next-easytour] failed to load the editor chunk:", err);
      });

    return () => { cancelled = true; };
  }, [enabled]);

  return enabled ? chunk : null;
}

/** Test seam — forgets the cached chunk so a fresh load can be observed. */
export function resetEditorChunkForTests(): void {
  cached = null;
  pending = null;
  failed = false;
}
