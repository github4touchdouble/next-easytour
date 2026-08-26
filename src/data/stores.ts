"use client";

/**
 * @module data/stores
 *
 * Where a tutorial's steps come from, and where the editor writes them
 * back. One small interface, a few ready-made implementations.
 *
 * Under 0.3 every host wrote this itself: a `fetch` with a cache-buster,
 * a bespoke `onSave` that POSTed somewhere, and an adapter in between.
 * A store is that plumbing, named and reusable.
 */

import { normalizeTutorial, type NormalizedTutorial } from "./normalize";
import type { Step, TriggerConfig } from "../types";

// ── Interface ───────────────────────────────────────────────────────────

export interface TutorialPayload<Meta = never> {
  steps: Step<Meta>[];
  trigger?: TriggerConfig;
  version: number;
}

export interface TutorialStore<Meta = never> {
  /** Shown in the editor UI so an author knows where Save goes. */
  readonly name: string;
  /** Read the tutorial. Omit for a store that is write-only. */
  load?: (signal?: AbortSignal) => Promise<NormalizedTutorial<Meta>>;
  /** Persist the tutorial. Reject to surface an error in the editor. */
  save?: (payload: TutorialPayload<Meta>) => Promise<void>;
  /** True when `save` cannot work in the current environment. */
  readonly: boolean;
}

// ── Static ──────────────────────────────────────────────────────────────

/** Steps defined in code. Read-only; Save falls back to the clipboard. */
export function staticStore<Meta = never>(steps: Step<Meta>[]): TutorialStore<Meta> {
  return {
    name: "in-code steps",
    readonly: true,
    load: async () => ({ steps, version: 1 }),
  };
}

// ── HTTP ────────────────────────────────────────────────────────────────

export interface HttpStoreOptions {
  /** Where `save` POSTs. Defaults to the load URL. */
  saveTo?: string;
  /** HTTP method for saves. Default "POST". */
  method?: string;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
  /**
   * Append a cache-busting query param on load. Static JSON served by a
   * CDN is otherwise stale right after a save. Default `true`.
   */
  bustCache?: boolean;
  /**
   * Send a bare `Step[]` array instead of a `{ steps, trigger }`
   * envelope. Use for endpoints written against the 0.2/0.3 format.
   * Default `false`.
   */
  bareArray?: boolean;
}

/**
 * Load from a URL, save to an endpoint.
 *
 * ```ts
 * httpStore("/umap-tutorial.json", { saveTo: "/api/tutorial" })
 * ```
 *
 * Pair with `createTutorialFileRoute` from `next-easytour/server` to get
 * the write side without hand-writing a route handler.
 */
export function httpStore<Meta = never>(
  url: string,
  options: HttpStoreOptions = {},
): TutorialStore<Meta> {
  const {
    saveTo = url,
    method = "POST",
    headers,
    credentials,
    bustCache = true,
    bareArray = false,
  } = options;

  return {
    name: url,
    readonly: false,

    load: async (signal) => {
      const href = bustCache
        ? `${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`
        : url;
      const res = await fetch(href, { signal, credentials, cache: "no-store" });
      if (!res.ok) {
        throw new Error(`[next-easytour] GET ${url} failed: ${res.status} ${res.statusText}`);
      }
      return normalizeTutorial<Meta>(await res.json());
    },

    save: async (payload) => {
      const res = await fetch(saveTo, {
        method,
        credentials,
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(bareArray ? payload.steps : payload),
      });
      if (!res.ok) {
        // Surface the server's own message — "editing is disabled in
        // production" is far more useful than a bare 403.
        let detail = `${res.status} ${res.statusText}`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body?.error) detail = body.error;
        } catch {
          /* non-JSON error body */
        }
        throw new Error(`[next-easytour] save to ${saveTo} failed: ${detail}`);
      }
    },
  };
}

// ── Browser storage ─────────────────────────────────────────────────────

/**
 * `window.localStorage`, or null where it does not exist.
 *
 * It is missing more often than you would expect: during SSR, in Safari
 * private mode, under a restrictive storage policy, and in some test
 * runners. Reading it through here keeps every call site honest about
 * that instead of throwing a bare TypeError on `undefined.getItem`.
 */
function getLocalStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Persist to `localStorage`. Good for drafting a tour before wiring a
 * backend, and for letting authors keep work-in-progress across reloads.
 */
export function localStore<Meta = never>(
  key: string,
  options: { fallback?: Step<Meta>[] } = {},
): TutorialStore<Meta> {
  const fallback = () => ({ steps: options.fallback ?? [], version: 1 });

  return {
    name: `localStorage:${key}`,
    readonly: false,

    load: async () => {
      const storage = getLocalStorage();
      if (!storage) return fallback();
      try {
        const raw = storage.getItem(key);
        if (raw === null) return fallback();
        return normalizeTutorial<Meta>(JSON.parse(raw));
      } catch {
        // A corrupt or unreadable draft must not take the tour down —
        // the tour still has to render for everyone else.
        return fallback();
      }
    },

    save: async (payload) => {
      const storage = getLocalStorage();
      if (!storage) {
        // Rejecting lets the editor show "save failed" and fall back to
        // the clipboard, rather than reporting a save that never landed.
        throw new Error(
          `[next-easytour] localStorage is unavailable; cannot save "${key}".`,
        );
      }
      storage.setItem(key, JSON.stringify(payload));
    },
  };
}

/** Save by copying JSON to the clipboard — the 0.3 default, made explicit. */
export function clipboardStore<Meta = never>(
  steps: Step<Meta>[] = [],
): TutorialStore<Meta> {
  return {
    name: "clipboard",
    readonly: false,
    load: async () => ({ steps, version: 1 }),
    save: async (payload) => {
      await navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
    },
  };
}

// ── Composition ─────────────────────────────────────────────────────────

/**
 * Read through `draft` when it has content, otherwise `source`; always
 * write to `draft`.
 *
 * The point is authoring against a read-only deployment: steps ship in
 * the bundle or on a CDN, an admin edits them locally, and their draft
 * wins until they discard it — without needing a writable endpoint.
 */
export function draftOver<Meta = never>(
  source: TutorialStore<Meta>,
  draft: TutorialStore<Meta>,
): TutorialStore<Meta> {
  return {
    name: `${draft.name} over ${source.name}`,
    readonly: draft.readonly,
    load: async (signal) => {
      const local = await draft.load?.(signal);
      if (local && local.steps.length > 0) return local;
      return (await source.load?.(signal)) ?? { steps: [], version: 1 };
    },
    save: draft.save?.bind(draft),
  };
}
