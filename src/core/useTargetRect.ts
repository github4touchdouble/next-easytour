"use client";

/**
 * @module core/useTargetRect
 *
 * Internal observation hook. Returns a live `DOMRect`-shaped rect for
 * a named target, re-observing whenever the target moves, resizes,
 * scrolls, or (re-)mounts.
 *
 * Sources of change:
 *   - Target resize via `ResizeObserver`.
 *   - Window scroll (capture) and window resize.
 *   - Target mount / unmount via the registry's version counter
 *     (subscribed through `useRegistryVersion`).
 */

import { useEffect, useRef, useState } from "react";
import { useRegistryVersion, useTargetRegistry } from "./Tutorial";

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const EMPTY: null = null;

function readRect(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

function rectsEqual(a: Rect | null, b: Rect | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

/**
 * Observe the rect of a registered target. Returns `null` while the
 * target is not yet registered or has been unregistered.
 */
export function useTargetRect(id: string | null): Rect | null {
  const registry = useTargetRegistry();
  const version = useRegistryVersion(registry);
  const [rect, setRect] = useState<Rect | null>(EMPTY);
  const rectRef = useRef<Rect | null>(EMPTY);

  useEffect(() => {
    if (!registry || id === null) {
      rectRef.current = EMPTY;
      setRect(EMPTY);
      return;
    }

    const el = registry.get(id);
    if (!el) {
      rectRef.current = EMPTY;
      setRect(EMPTY);
      return;
    }

    const sync = () => {
      const next = readRect(el);
      if (!rectsEqual(rectRef.current, next)) {
        rectRef.current = next;
        setRect(next);
      }
    };

    sync();

    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(sync) : null;
    ro?.observe(el);
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);

    return () => {
      ro?.disconnect();
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [id, registry, version]);

  return rect;
}