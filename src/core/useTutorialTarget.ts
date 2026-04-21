"use client";

/**
 * @module core/useTutorialTarget
 *
 * The public ref-registration hook. Replaces the 0.2.x
 * `data-tutorial-id="..."` attribute convention with a typed API that
 * doesn't pollute host markup or collide across libraries.
 *
 * Usage:
 *
 *     function SaveButton() {
 *       const ref = useTutorialTarget("save");
 *       return <button ref={ref}>Save</button>;
 *     }
 *
 * The hook returns a React callback ref. When React mounts the
 * element, the callback fires with the DOM node and the element is
 * registered; when React unmounts it, the callback fires with `null`
 * and the element is de-registered. This is the pattern React uses
 * for lifecycle-aware refs — it's safe across re-renders,
 * remounts, and conditional rendering.
 *
 * The hook is a no-op outside a `<Tutorial>` subtree. It logs a
 * warning in development and silently does nothing in production,
 * so mis-placed targets don't crash the app.
 */

import { useCallback, useRef } from "react";
import { useTargetRegistry } from "./Tutorial";

/**
 * Register an element as a named tutorial target. Returns a callback
 * ref to spread onto the element you want to highlight or point at.
 *
 * @param id - A string identifier referenced from `Step.targets` and
 *   `Step.annotations.arrow`. Must match exactly.
 */
export function useTutorialTarget<E extends Element = HTMLElement>(
  id: string,
): (el: E | null) => void {
  const registry = useTargetRegistry();

  // Track the last element we registered so we can de-register it on
  // unmount even if the registry context has gone away by then.
  const lastElRef = useRef<Element | null>(null);

  return useCallback(
    (el: E | null) => {
      if (!registry) {
        if (
          typeof process !== "undefined" &&
          process.env?.NODE_ENV !== "production" &&
          el !== null
        ) {
          // eslint-disable-next-line no-console
          console.warn(
            `[next-easytour] useTutorialTarget("${id}") used outside ` +
              `a <Tutorial> subtree. The ref will be a no-op.`,
          );
        }
        return;
      }

      // De-register the previous element if we're switching to a new
      // one without an unmount step — can happen if the same hook
      // site toggles between two DOM nodes conditionally.
      if (lastElRef.current && lastElRef.current !== el) {
        registry.register(id, null);
      }

      lastElRef.current = el;
      registry.register(id, el);
    },
    [id, registry],
  );
}