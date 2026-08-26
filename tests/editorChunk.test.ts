/**
 * @vitest-environment jsdom
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorChunk, resetEditorChunkForTests } from "../src/editor/useEditorChunk";

afterEach(() => resetEditorChunkForTests());

// ────────────────────────────────────────────────────────────────────────
// Structural guards
// ────────────────────────────────────────────────────────────────────────
//
// The editor UI stays out of production bundles only because nothing on
// the main render path imports it statically. That is an invariant of the
// source tree, not of any single file, so it is checked as one — a stray
// `import { EditorPanel } from "./EditorPanel"` anywhere else silently
// puts ~45 KB of authoring interface back into every visitor's download,
// and nothing else in the suite would notice.

const SRC = resolve(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) && !name.endsWith(".d.ts") ? [full] : [];
  });
}

/**
 * Strip comments, so an assertion about the *code* is not satisfied or
 * broken by prose. These files explain the invariant in their headers,
 * which means they mention the very identifiers under test.
 */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** Static imports only — `import type` is erased and cannot pull code in. */
function staticImportsOf(file: string): string[] {
  const code = stripComments(readFileSync(file, "utf-8"));
  const out: string[] = [];
  const re = /^\s*(?:import|export)\s+(?!type\b)(?:[^;'"]*?\s+from\s+)?["']([^"']+)["']/gm;
  for (const m of code.matchAll(re)) out.push(m[1]);
  return out;
}

const UI_MODULES = ["EditorPanel", "EditorHandles", "EditorSeam"];

describe("editor chunk — source structure", () => {
  it("is imported statically only by the chunk entry itself", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      const rel = relative(SRC, file);
      // The chunk entry exists to import them; each module may import itself.
      if (rel === join("editor", "chrome.tsx")) continue;
      if (UI_MODULES.some((m) => rel === join("editor", `${m}.tsx`))) continue;

      for (const spec of staticImportsOf(file)) {
        const hit = UI_MODULES.find((m) => spec.endsWith(`/${m}`) || spec === `./${m}`);
        if (hit) offenders.push(`${rel} imports ${hit}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("has exactly one dynamic import of the chunk, in the loader", () => {
    const sites = sourceFiles(SRC).filter((f) =>
      /import\(\s*["'][^"']*chrome["']\s*\)/.test(readFileSync(f, "utf-8")),
    );
    expect(sites.map((f) => relative(SRC, f))).toEqual([join("editor", "useEditorChunk.ts")]);
  });

  it("guards that import with a foldable NODE_ENV comparison", () => {
    // `process.env.NODE_ENV` is the exact expression bundlers substitute.
    // Optional chaining (`process.env?.NODE_ENV`) is not, and would leave
    // the branch — and the chunk reference — alive in production.
    const code = stripComments(readFileSync(join(SRC, "editor", "useEditorChunk.ts"), "utf-8"));
    expect(code).toMatch(/process\.env\.NODE_ENV !== "production"/);
    expect(code).not.toMatch(/process\.env\?\.NODE_ENV/);
  });

  it("keeps `Editor` and `useEditorState` out of the chunk", () => {
    // A 0.3-style host wraps its tour in <Editor> unconditionally and
    // needs it to pass steps through in production; a hook cannot be
    // loaded asynchronously at all.
    const chrome = stripComments(readFileSync(join(SRC, "editor", "chrome.tsx"), "utf-8"));
    expect(chrome).not.toMatch(/export\s*\{[^}]*\bEditor\b[^}]*\}\s*from\s*["']\.\/Editor["']/);
    expect(chrome).not.toMatch(/useEditorState/);
  });
});

// ────────────────────────────────────────────────────────────────────────
// Loader behaviour
// ────────────────────────────────────────────────────────────────────────

describe("useEditorChunk", () => {
  it("loads nothing for a user who may not edit", async () => {
    const { result } = renderHook(() => useEditorChunk(false));
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current).toBeNull();
  });

  it("resolves to the authoring components for a user who may", async () => {
    const { result } = renderHook(() => useEditorChunk(true));
    // Generous: on a cold run the test runner transforms the chunk on
    // demand, which can outlast waitFor's 1s default.
    await waitFor(() => expect(result.current).not.toBeNull(), { timeout: 15000 });
    expect(typeof result.current!.EditorPanel).toBe("function");
    expect(typeof result.current!.EditorHandles).toBe("function");
    expect(typeof result.current!.EditorSeam).toBe("function");
  });

  it("serves a second caller from cache, without a second load", async () => {
    const first = renderHook(() => useEditorChunk(true));
    await waitFor(() => expect(first.result.current).not.toBeNull(), { timeout: 15000 });

    // Cached: available on the very first render, no await needed.
    const second = renderHook(() => useEditorChunk(true));
    expect(second.result.current).toBe(first.result.current);
  });

  it("hides the chunk again if the user loses permission", async () => {
    const { result, rerender } = renderHook(
      ({ allowed }: { allowed: boolean }) => useEditorChunk(allowed),
      { initialProps: { allowed: true } },
    );
    await waitFor(() => expect(result.current).not.toBeNull(), { timeout: 15000 });

    rerender({ allowed: false });
    expect(result.current).toBeNull();
  });
});
