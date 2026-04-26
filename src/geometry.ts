/**
 * @module geometry
 *
 * Arrow geometry. All functions are pure and framework-free so the
 * arrow behaviour can be unit-tested without a DOM.
 *
 * The arrow connects the tutorial card to a target point. Where it
 * originates on the card depends on the direction of the target:
 * 0.2.x always drew from the card's top-centre, which looked
 * sensible for a bottom-docked card but fell apart as soon as the
 * author repositioned the card. 0.3.0 picks the card edge nearest
 * the target — see `nearestCardEdge`.
 */

import type { ArrowStyle } from "./types";

// ────────────────────────────────────────────────────────────────────────
// Style defaults
// ────────────────────────────────────────────────────────────────────────

/**
 * Baseline style for the Bézier arrow. Every `ArrowStyle` field users
 * supply is merged into this record before the arrow is drawn.
 */
export const DEFAULT_STYLE: Required<ArrowStyle> = {
  bend: 30,
  flip: false,
  strokeWidth: 1.5,
  dashed: false,
  headSize: 8,
  loopEnd: false,
  animated: true,
  straight: false,
};

/** Merge a partial style onto the defaults. */
export function resolveStyle(style?: ArrowStyle): Required<ArrowStyle> {
  return style ? { ...DEFAULT_STYLE, ...style } : DEFAULT_STYLE;
}

// ────────────────────────────────────────────────────────────────────────
// Card edge resolution
// ────────────────────────────────────────────────────────────────────────

/**
 * Pick the point on the card's perimeter that is closest (in the
 * plane) to the target. The arrow then originates from that edge
 * midpoint instead of always the top-centre.
 *
 * Why edges, not corners: a straight line from a corner to the target
 * often passes diagonally through the card body, which looks like the
 * arrow is piercing the card. Edge midpoints avoid that.
 *
 * Returns the chosen point in page-pixel coordinates.
 */
export function nearestCardEdge(
  card: { left: number; top: number; width: number; height: number },
  target: { x: number; y: number },
): { x: number; y: number } {
  const cx = card.left + card.width / 2;
  const cy = card.top + card.height / 2;
  const right = card.left + card.width;
  const bottom = card.top + card.height;

  // Signed vector from card centre to target.
  const dx = target.x - cx;
  const dy = target.y - cy;

  // Pick the dominant axis — the side the target is most clearly on.
  // Scaling by width/height avoids a bias toward wider cards.
  const hRatio = Math.abs(dx) / (card.width / 2);
  const vRatio = Math.abs(dy) / (card.height / 2);

  if (hRatio > vRatio) {
    // Target is to the left or right of the card's core.
    return { x: dx > 0 ? right : card.left, y: cy };
  }
  // Target is above or below.
  return { x: cx, y: dy > 0 ? bottom : card.top };
}

// ────────────────────────────────────────────────────────────────────────
// Bézier path
// ────────────────────────────────────────────────────────────────────────

/**
 * Build an SVG cubic-Bézier path from the card's chosen source point
 * (`s`) to the arrow tip (`t`). The curve arcs perpendicular to the
 * straight line by `bend` percent of the straight-line distance,
 * clamped to a minimum of 20 pixels so short arrows still curve
 * visibly.
 *
 * The perpendicular direction is chosen so the arc bends away from
 * whichever half of the plane the card body occupies; `flip` mirrors
 * the choice for steps where the opposite bend reads better.
 *
 * Purely a string-building function — returns the `d` attribute
 * value ready to paste into `<path d={…}>`.
 */
export function buildPath(
  s: { x: number; y: number },
  t: { x: number; y: number },
  style: Required<ArrowStyle>,
): string {
  // Straight line — no curve
  if (style.straight) {
    return `M${s.x},${s.y} L${t.x},${t.y}`;
  }

  const dx = t.x - s.x;
  const dy = t.y - s.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const bend = Math.max(dist * (style.bend / 100), 20);

  // Perpendicular unit vector.
  const nx = -dy / (dist || 1);
  const ny = dx / (dist || 1);

  // Choose bend direction: upward curves read better for arrows that
  // go mostly horizontal; inverted when `flip` is set.
  let sign = ny > 0 ? -1 : 1;
  if (style.flip) sign *= -1;

  const c1x = s.x + dx * 0.25 + nx * bend * sign;
  const c1y = s.y + dy * 0.25 + ny * bend * sign;
  const c2x = s.x + dx * 0.75 + nx * bend * sign;
  const c2y = s.y + dy * 0.75 + ny * bend * sign;

  return `M${s.x},${s.y} C${c1x},${c1y} ${c2x},${c2y} ${t.x},${t.y}`;
}

// ────────────────────────────────────────────────────────────────────────
// Overlap detection
// ────────────────────────────────────────────────────────────────────────

/**
 * True if the card's bounding box contains the target point. When it
 * does, the arrow degenerates to zero length and shouldn't be drawn.
 * Callers hide the arrow entirely in this case rather than emitting a
 * malformed path.
 */
export function cardContainsPoint(
  card: { left: number; top: number; width: number; height: number },
  target: { x: number; y: number },
): boolean {
  return (
    target.x >= card.left &&
    target.x <= card.left + card.width &&
    target.y >= card.top &&
    target.y <= card.top + card.height
  );
}