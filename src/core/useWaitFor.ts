"use client";

/**
 * @module core/useWaitFor
 *
 * Evaluates a step's `waitFor` condition and reports whether it has
 * been satisfied. The Tutorial provider reads `isWaiting` to block
 * forward navigation.
 *
 * Conditions:
 *   - click: wait for a click on a target or selector
 *   - input: wait for input matching an optional regex
 *   - event: wait for a custom DOM event
 *   - delay: wait for N milliseconds
 *   - visible: wait for an element to appear (IntersectionObserver)
 *   - custom: poll a predicate function
 */

import { useEffect, useState, useRef } from "react";
import type { Step, WaitCondition } from "../types";

export function useWaitFor(
  step: Step<never> | null,
  getElement: (id?: string) => Element | null,
): boolean {
  const [satisfied, setSatisfied] = useState(false);
  const getElementRef = useRef(getElement);
  getElementRef.current = getElement;

  // Reset on step change
  useEffect(() => {
    setSatisfied(false);
  }, [step?.id]);

  useEffect(() => {
    if (!step?.waitFor) {
      setSatisfied(true);
      return;
    }

    const cond: WaitCondition = step.waitFor;
    let cleanup: (() => void) | undefined;

    const resolveEl = (selector?: string): Element | null => {
      if (selector) return document.querySelector(selector);
      return getElementRef.current(step.targets?.[0] ?? step.selector ?? undefined);
    };

    switch (cond.type) {
      case "click": {
        const handler = () => setSatisfied(true);
        const el = resolveEl(cond.selector);
        const target = el ?? document;
        target.addEventListener("click", handler, { once: true });
        cleanup = () => target.removeEventListener("click", handler);
        break;
      }
      case "input": {
        const el = resolveEl(cond.selector);
        if (el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
          const regex = cond.pattern ? new RegExp(cond.pattern) : null;
          const handler = () => {
            const val = (el as HTMLInputElement).value;
            if (!regex || regex.test(val)) setSatisfied(true);
          };
          // Check immediately
          handler();
          el.addEventListener("input", handler);
          cleanup = () => el.removeEventListener("input", handler);
        }
        break;
      }
      case "event": {
        const el = resolveEl(cond.selector) ?? document;
        const handler = () => setSatisfied(true);
        el.addEventListener(cond.name, handler, { once: true });
        cleanup = () => el.removeEventListener(cond.name, handler);
        break;
      }
      case "delay": {
        const t = setTimeout(() => setSatisfied(true), cond.ms);
        cleanup = () => clearTimeout(t);
        break;
      }
      case "visible": {
        const check = () => {
          const el = document.querySelector(cond.selector);
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        };
        if (check()) {
          setSatisfied(true);
        } else {
          // Use MutationObserver + periodic check
          const interval = setInterval(() => {
            if (check()) { setSatisfied(true); clearInterval(interval); }
          }, 200);
          cleanup = () => clearInterval(interval);
        }
        break;
      }
      case "custom": {
        const pollMs = cond.pollMs ?? 200;
        if (cond.predicate()) {
          setSatisfied(true);
        } else {
          const interval = setInterval(() => {
            try {
              if (cond.predicate()) { setSatisfied(true); clearInterval(interval); }
            } catch { /* ignore */ }
          }, pollMs);
          cleanup = () => clearInterval(interval);
        }
        break;
      }
    }

    return () => { cleanup?.(); };
  }, [step?.id, step?.waitFor]); // eslint-disable-line react-hooks/exhaustive-deps

  return !step?.waitFor ? true : satisfied;
}