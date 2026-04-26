"use client";

/**
 * @module core/OverlayPortal
 *
 * Portals children to document.body so `position: fixed` / `absolute`
 * works even when ancestors have `transform` or `filter` CSS.
 *
 * Renders the portal synchronously (no mount delay). This is safe
 * because tour overlays only render when a step is active, which
 * never happens during SSR.
 */

import { createPortal } from "react-dom";

export function OverlayPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}