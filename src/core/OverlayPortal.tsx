"use client";

/**
 * @module core/OverlayPortal
 *
 * Portals children to document.body. All fixed-positioned overlay
 * elements (Card, Arrow, Spotlight, Circles, editor toolbar/panel)
 * must render at the top level of the DOM because `position: fixed`
 * breaks when any ancestor has a CSS `transform`, `perspective`,
 * `filter`, or `contain: paint`. React portals preserve context
 * (useTutorial, useEditor, etc.) while escaping the DOM hierarchy.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function OverlayPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}