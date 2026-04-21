/**
 * @module coords
 *
 * Constructors and conversions for the two coordinate systems the
 * library uses — `TargetPoint` (percentage of a target's bounding rect)
 * and `ViewportAnchor` (percentage of the viewport). Both are nominal
 * types carrying a `space` discriminator to prevent accidental mixing.
 *
 * All functions here are pure: they take shapes (not DOM elements) and
 * return shapes. DOM access lives in the hooks. This separation makes
 * the conversions trivially unit-testable.
 */

import type { TargetPoint, ViewportAnchor } from "./types";

// ────────────────────────────────────────────────────────────────────────
// Constructors
// ────────────────────────────────────────────────────────────────────────

/** Create a `TargetPoint` with the discriminator set correctly. */
export function targetPoint(x: number, y: number): TargetPoint {
  return { space: "target", x, y };
}

/** Create a `ViewportAnchor` with the discriminator set correctly. */
export function viewportAnchor(x: number, y: number): ViewportAnchor {
  return { space: "viewport", x, y };
}

// ────────────────────────────────────────────────────────────────────────
// Defaults
// ────────────────────────────────────────────────────────────────────────

/**
 * Default arrow tip when no explicit target point is given. Points at
 * the centre-bottom of the target — the gravity is toward the card
 * (which lives at the bottom of the viewport by default), so the arrow
 * draws a short, gentle curve instead of slicing across the target.
 */
export const DEFAULT_TARGET_POINT: TargetPoint = targetPoint(50, 90);

/**
 * Default card position when no per-step `cardAnchor` is given. A
 * sentinel value — the `<Card>` component interprets this as "bottom-
 * centre, 1.5rem above the viewport bottom" and applies a centring
 * transform accordingly. See `isDefaultAnchor`.
 */
export const DEFAULT_VIEWPORT_ANCHOR: ViewportAnchor = viewportAnchor(50, 85);

/**
 * True if an anchor is (close enough to) the default. Used by the
 * Card so the default placement can apply a centring transform while
 * authored placements are rendered literally from their top-left.
 */
export function isDefaultAnchor(a: ViewportAnchor): boolean {
  return (
    Math.abs(a.x - DEFAULT_VIEWPORT_ANCHOR.x) < 0.01 &&
    Math.abs(a.y - DEFAULT_VIEWPORT_ANCHOR.y) < 0.01
  );
}

// ────────────────────────────────────────────────────────────────────────
// Pixel ↔ target-relative
// ────────────────────────────────────────────────────────────────────────

/**
 * Resolve a `TargetPoint` against a target's client-rect to get
 * absolute viewport pixel coordinates.
 *
 * Returns `null` if the target has zero area — callers should skip
 * drawing arrows in that case rather than dividing by zero.
 */
export function targetPointToPx(
  pt: TargetPoint,
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } | null {
  if (rect.width === 0 && rect.height === 0) return null;
  return {
    x: rect.left + rect.width * (pt.x / 100),
    y: rect.top + rect.height * (pt.y / 100),
  };
}

/**
 * Convert absolute viewport pixel coordinates back into a
 * `TargetPoint`. Used by the drag handler to translate live mouse
 * coordinates into the persistent relative representation.
 *
 * Returns `null` if the target has zero area.
 */
export function pxToTargetPoint(
  px: { x: number; y: number },
  rect: { left: number; top: number; width: number; height: number },
): TargetPoint | null {
  if (rect.width === 0 || rect.height === 0) return null;
  return targetPoint(
    Math.round(((px.x - rect.left) / rect.width) * 1000) / 10,
    Math.round(((px.y - rect.top) / rect.height) * 1000) / 10,
  );
}

// ────────────────────────────────────────────────────────────────────────
// Pixel ↔ viewport-relative
// ────────────────────────────────────────────────────────────────────────

/**
 * Resolve a `ViewportAnchor` against the current viewport size to get
 * pixel coordinates (of the anchor's top-left interpretation).
 */
export function viewportAnchorToPx(
  anchor: ViewportAnchor,
  viewport: { width: number; height: number },
): { x: number; y: number } {
  return {
    x: viewport.width * (anchor.x / 100),
    y: viewport.height * (anchor.y / 100),
  };
}

/**
 * Convert absolute pixel coordinates into a `ViewportAnchor` fraction
 * of the current viewport size. Used by the card drag handler.
 */
export function pxToViewportAnchor(
  px: { x: number; y: number },
  viewport: { width: number; height: number },
): ViewportAnchor {
  return viewportAnchor(
    Math.round((px.x / viewport.width) * 10000) / 100,
    Math.round((px.y / viewport.height) * 10000) / 100,
  );
}

// ────────────────────────────────────────────────────────────────────────
// Clamping
// ────────────────────────────────────────────────────────────────────────

/**
 * Clamp a viewport anchor so the element it positions cannot be
 * dragged fully off-screen. Keeps `keepVisiblePx` pixels inside the
 * viewport on every side regardless of element size.
 *
 * `elementPx` is the element's current width and height — needed so
 * we know how much of the element to require inside the viewport.
 */
export function clampViewportAnchor(
  anchor: ViewportAnchor,
  elementPx: { width: number; height: number },
  viewport: { width: number; height: number },
  keepVisiblePx = 24,
): ViewportAnchor {
  // Convert the "keep visible" bound from pixels into anchor %.
  const minX = -((elementPx.width - keepVisiblePx) / viewport.width) * 100;
  const maxX = ((viewport.width - keepVisiblePx) / viewport.width) * 100;
  const minY = 0;
  const maxY = ((viewport.height - keepVisiblePx) / viewport.height) * 100;
  return viewportAnchor(
    Math.min(maxX, Math.max(minX, anchor.x)),
    Math.min(maxY, Math.max(minY, anchor.y)),
  );
}