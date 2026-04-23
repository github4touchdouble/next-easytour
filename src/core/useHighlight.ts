"use client";

/**
 * @module core/useHighlight
 *
 * Manages the highlight overlay element that renders a pulsing ring
 * around the active step's target. The overlay is a single fixed-
 * positioned div styled via CSS — no SVG needed.
 *
 * The highlight div is appended to `document.body` on mount and
 * removed on unmount (step leave or tour close).
 */

import { useEffect, useRef } from "react";
import type { HighlightEffect, Step } from "../types";

function resolveHighlight(
  step: Step<never>,
): HighlightEffect | null {
  if (!step.highlight) return null;
  if (step.highlight === true) {
    return { pulse: true, padding: 4, borderRadius: 6 };
  }
  return {
    pulse: step.highlight.pulse ?? true,
    color: step.highlight.color,
    padding: step.highlight.padding ?? 4,
    borderRadius: step.highlight.borderRadius ?? 6,
  };
}

export function useHighlight(
  step: Step<never> | null,
  getElement: (id?: string) => Element | null,
): void {
  const divRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);
  const getElementRef = useRef(getElement);
  getElementRef.current = getElement;

  useEffect(() => {
    if (!step) return;
    const config = resolveHighlight(step as Step<never>);
    if (!config) return;

    // Create the highlight overlay
    const div = document.createElement("div");
    div.className = "eto-highlight-ring" + (config.pulse ? " eto-highlight-pulse" : "");
    div.setAttribute("aria-hidden", "true");
    if (config.color) {
      div.style.setProperty("--eto-highlight-color", config.color);
    }
    document.body.appendChild(div);
    divRef.current = div;

    const pad = config.padding ?? 4;
    const br = config.borderRadius ?? 6;

    // Track the target rect
    const sync = () => {
      const el = getElementRef.current(
        step.targets?.[0] ?? step.selector ?? undefined,
      );
      if (!el || !divRef.current) return;
      const r = el.getBoundingClientRect();
      const d = divRef.current;
      d.style.left = `${r.left - pad}px`;
      d.style.top = `${r.top - pad}px`;
      d.style.width = `${r.width + pad * 2}px`;
      d.style.height = `${r.height + pad * 2}px`;
      d.style.borderRadius = `${br}px`;
      rafRef.current = requestAnimationFrame(sync);
    };

    // Start tracking after a micro-delay so scroll-into-view settles
    const start = setTimeout(() => {
      rafRef.current = requestAnimationFrame(sync);
    }, 100);

    return () => {
      clearTimeout(start);
      cancelAnimationFrame(rafRef.current);
      if (divRef.current) {
        divRef.current.remove();
        divRef.current = null;
      }
    };
  }, [step?.id]); // eslint-disable-line react-hooks/exhaustive-deps
}