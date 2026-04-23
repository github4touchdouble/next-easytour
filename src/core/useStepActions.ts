"use client";

/**
 * @module core/useStepActions
 *
 * Executes declarative step actions in sequence on step enter.
 * Returns a cleanup function that reverses reversible actions
 * (class additions, attribute sets, highlights) on step leave.
 *
 * Action execution is async-sequential: each action runs after the
 * previous one completes. `{ type: "wait", ms: 500 }` inserts a
 * pause. If the step changes before all actions complete, pending
 * actions are cancelled via an AbortController.
 */

import { useCallback, useEffect, useRef } from "react";
import type { Step, StepAction } from "../types";

/**
 * Resolve a target element: tries CSS selector first, falls back to
 * the provided `getElement` callback (which checks the hook registry).
 */
function resolveElement(
  action: { selector?: string },
  step: Step<never>,
  getElement: (id?: string) => Element | null,
): Element | null {
  if (action.selector) {
    return document.querySelector(action.selector);
  }
  // Fall back to the step's primary target
  return getElement(step.targets?.[0] ?? step.selector ?? undefined);
}

async function executeAction(
  action: StepAction,
  step: Step<never>,
  getElement: (id?: string) => Element | null,
  cleanups: (() => void)[],
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) return;

  switch (action.type) {
    case "scroll-into-view": {
      const el = resolveElement({}, step, getElement);
      if (el) {
        el.scrollIntoView({
          behavior: action.behavior ?? "smooth",
          block: action.block ?? "center",
          inline: action.inline ?? "nearest",
        });
        // Wait for scroll to settle
        await new Promise((r) => setTimeout(r, 350));
      }
      break;
    }
    case "click": {
      const el = resolveElement(action, step, getElement);
      if (el && el instanceof HTMLElement) {
        el.click();
      }
      break;
    }
    case "focus": {
      const el = resolveElement(action, step, getElement);
      if (el && el instanceof HTMLElement) {
        el.focus();
      }
      break;
    }
    case "highlight": {
      const el = resolveElement({}, step, getElement);
      if (el && el instanceof HTMLElement) {
        const cls = action.className ?? "eto-action-highlight";
        if (action.pulse !== false) {
          el.classList.add("eto-action-pulse");
          cleanups.push(() => el.classList.remove("eto-action-pulse"));
        }
        el.classList.add(cls);
        cleanups.push(() => el.classList.remove(cls));

        if (action.duration) {
          await new Promise((r) => setTimeout(r, action.duration));
          if (!signal.aborted) {
            el.classList.remove(cls);
            el.classList.remove("eto-action-pulse");
          }
        }
      }
      break;
    }
    case "add-class": {
      const el = resolveElement(action, step, getElement);
      if (el) {
        el.classList.add(action.className);
        cleanups.push(() => el.classList.remove(action.className));
      }
      break;
    }
    case "remove-class": {
      const el = resolveElement(action, step, getElement);
      if (el) {
        const had = el.classList.contains(action.className);
        el.classList.remove(action.className);
        if (had) cleanups.push(() => el.classList.add(action.className));
      }
      break;
    }
    case "set-attribute": {
      const el = resolveElement(action, step, getElement);
      if (el) {
        const prev = el.getAttribute(action.name);
        el.setAttribute(action.name, action.value);
        cleanups.push(() => {
          if (prev === null) el.removeAttribute(action.name);
          else el.setAttribute(action.name, prev);
        });
      }
      break;
    }
    case "dispatch": {
      const el = resolveElement(action, step, getElement) ?? document;
      el.dispatchEvent(
        new CustomEvent(action.event, { detail: action.detail, bubbles: true }),
      );
      break;
    }
    case "wait": {
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, action.ms);
        signal.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
      });
      break;
    }
  }
}

/**
 * Run step actions on enter. Returns nothing — cleanup is handled
 * internally via the effect's destructor.
 */
export function useStepActions(
  step: Step<never> | null,
  getElement: (id?: string) => Element | null,
): void {
  const getElementRef = useRef(getElement);
  getElementRef.current = getElement;

  useEffect(() => {
    if (!step || !step.actions || step.actions.length === 0) return;

    const ac = new AbortController();
    const cleanups: (() => void)[] = [];

    (async () => {
      for (const action of step.actions!) {
        if (ac.signal.aborted) break;
        try {
          await executeAction(
            action,
            step as Step<never>,
            getElementRef.current,
            cleanups,
            ac.signal,
          );
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("[next-easytour] action threw:", err);
        }
      }
    })();

    return () => {
      ac.abort();
      for (const fn of cleanups) {
        try { fn(); } catch { /* best-effort */ }
      }
    };
  }, [step?.id]); // eslint-disable-line react-hooks/exhaustive-deps
}