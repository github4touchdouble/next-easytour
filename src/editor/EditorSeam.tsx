"use client";

/**
 * @module editor/EditorSeam
 *
 * A yellow seam around the tour's entry point while the editor is
 * unlocked.
 *
 * Editing is a mode, and a mode you cannot see is a mode you forget you
 * are in. The seam marks where the tour lives on the page — its trigger
 * button — so an author can tell at a glance that this button belongs to
 * next-easytour and that their edits are live.
 *
 * It draws into a portal at fixed position and never touches layout:
 * `<TourTrigger>` reports its button's element, and the seam tracks that
 * element's rect. Nothing is wrapped, nothing is inserted inline.
 */

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { OverlayPortal } from "../core/OverlayPortal";
import type { Rect } from "../core/useTargetRect";

export interface EditorSeamProps {
  /** The element to enclose. Nothing renders when null. */
  target: Element | null;
  /** Text in the corner badge. Default "next-easytour". */
  label?: string;
  /** Padding between the element and the seam, in px. Default 6. */
  padding?: number;
}

function readRect(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

function same(a: Rect | null, b: Rect): boolean {
  return (
    a !== null &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

export function EditorSeam(props: EditorSeamProps) {
  const { target, label = "next-easytour", padding = 6 } = props;
  const [rect, setRect] = useState<Rect | null>(null);
  const lastRef = useRef<Rect | null>(null);

  // The trigger can move for reasons no event reports — a sticky header
  // collapsing, a font swapping in, an ancestor animating. <Card> already
  // solves this by re-reading every frame; the seam does the same, and
  // commits state only when the rect actually changed.
  useEffect(() => {
    if (!target) {
      lastRef.current = null;
      setRect(null);
      return;
    }
    let raf = 0;
    const tick = () => {
      const next = readRect(target);
      if (!same(lastRef.current, next)) {
        lastRef.current = next;
        setRect(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  if (!rect) return null;

  return (
    <OverlayPortal>
      <div
        className="eto-seam"
        aria-hidden="true"
        style={{
          left: rect.left - padding,
          top: rect.top - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
        }}
      >
        <span className="eto-seam-badge">{label}</span>
      </div>
    </OverlayPortal>
  );
}
