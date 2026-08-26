/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clipboardStore, draftOver, httpStore, localStore, staticStore } from "../src";
import type { Step } from "../src";

/**
 * An in-memory `Storage`.
 *
 * jsdom under Node 22 leaves `window.localStorage` undefined unless the
 * runtime is started with `--localstorage-file`, so the tests supply
 * their own rather than depending on the environment.
 */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => { map.clear(); },
  } as Storage;
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  Object.defineProperty(window, "localStorage", {
    value: globalThis.localStorage, configurable: true, writable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const steps: Step[] = [{ id: "a", title: "A" }];

// ────────────────────────────────────────────────────────────────────────
// staticStore
// ────────────────────────────────────────────────────────────────────────

describe("staticStore", () => {
  it("returns its steps and reports itself read-only", async () => {
    const store = staticStore(steps);
    expect(store.readonly).toBe(true);
    expect(store.save).toBeUndefined();
    expect((await store.load!()).steps).toEqual(steps);
  });
});

// ────────────────────────────────────────────────────────────────────────
// httpStore
// ────────────────────────────────────────────────────────────────────────

describe("httpStore — load", () => {
  it("normalises a legacy bare array from the wire", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify([{ id: "a", target: "umap", arrowTo: { x: 1, y: 2 } }]),
    )));
    const result = await httpStore("/tour.json").load!();
    expect(result.steps[0].targets).toEqual(["umap"]);
    expect(result.steps[0].annotations?.arrow?.to).toEqual({ space: "target", x: 1, y: 2 });
  });

  it("appends a cache-buster so a just-saved file is not served stale", async () => {
    const fetchMock = vi.fn(async () => new Response("[]"));
    vi.stubGlobal("fetch", fetchMock);
    await httpStore("/tour.json").load!();
    expect(fetchMock.mock.calls[0][0]).toMatch(/^\/tour\.json\?_=\d+$/);
  });

  it("joins the cache-buster with & when the URL already has a query", async () => {
    const fetchMock = vi.fn(async () => new Response("[]"));
    vi.stubGlobal("fetch", fetchMock);
    await httpStore("/tour.json?v=2").load!();
    expect(fetchMock.mock.calls[0][0]).toMatch(/^\/tour\.json\?v=2&_=\d+$/);
  });

  it("can be told not to bust the cache", async () => {
    const fetchMock = vi.fn(async () => new Response("[]"));
    vi.stubGlobal("fetch", fetchMock);
    await httpStore("/tour.json", { bustCache: false }).load!();
    expect(fetchMock.mock.calls[0][0]).toBe("/tour.json");
  });

  it("rejects on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 404 })));
    await expect(httpStore("/tour.json").load!()).rejects.toThrow(/404/);
  });
});

describe("httpStore — save", () => {
  it("POSTs a { steps, trigger } envelope to saveTo", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);

    await httpStore("/tour.json", { saveTo: "/api/tour" }).save!({
      steps, trigger: { text: "Go" }, version: 1,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/tour");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      steps, trigger: { text: "Go" }, version: 1,
    });
  });

  it("sends a bare array when bareArray is set, for 0.2/0.3 endpoints", async () => {
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    await httpStore("/tour.json", { bareArray: true }).save!({ steps, version: 1 });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual(steps);
  });

  it("defaults saveTo to the load URL", async () => {
    const fetchMock = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    await httpStore("/api/tour").save!({ steps, version: 1 });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/tour");
  });

  it("surfaces the server's own error message, not just the status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ error: "Tutorial editing is disabled in production" }),
      { status: 403 },
    )));
    await expect(httpStore("/api/tour").save!({ steps, version: 1 }))
      .rejects.toThrow(/disabled in production/);
  });

  it("falls back to the status line when the error body is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>500</html>", { status: 500 })));
    await expect(httpStore("/api/tour").save!({ steps, version: 1 })).rejects.toThrow(/500/);
  });
});

// ────────────────────────────────────────────────────────────────────────
// localStore
// ────────────────────────────────────────────────────────────────────────

describe("localStore", () => {
  it("round-trips a save through localStorage", async () => {
    const store = localStore("draft");
    await store.save!({ steps, version: 1 });
    expect((await store.load!()).steps).toEqual(steps);
  });

  it("returns the fallback when nothing is stored", async () => {
    expect((await localStore("draft", { fallback: steps }).load!()).steps).toEqual(steps);
  });

  it("returns the fallback rather than throwing on a corrupt draft", async () => {
    window.localStorage.setItem("draft", "{not json");
    expect((await localStore("draft", { fallback: steps }).load!()).steps).toEqual(steps);
  });
});

// ────────────────────────────────────────────────────────────────────────
// Composition
// ────────────────────────────────────────────────────────────────────────

describe("draftOver", () => {
  it("reads the source while the draft is empty", async () => {
    const store = draftOver(staticStore(steps), localStore("draft"));
    expect((await store.load!()).steps).toEqual(steps);
  });

  it("prefers the draft once it has content, and writes only to the draft", async () => {
    const edited: Step[] = [{ id: "a", title: "Edited" }];
    const store = draftOver(staticStore(steps), localStore("draft"));

    await store.save!({ steps: edited, version: 1 });

    expect((await store.load!()).steps).toEqual(edited);
    // The read-only source is untouched.
    expect((await staticStore(steps).load!()).steps).toEqual(steps);
  });
});

describe("clipboardStore", () => {
  it("writes formatted JSON to the clipboard", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await clipboardStore().save!({ steps, version: 1 });
    expect(JSON.parse(writeText.mock.calls[0][0] as string)).toEqual({ steps, version: 1 });
  });
});
