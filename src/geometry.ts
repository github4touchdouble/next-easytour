import type { ArrowPoint, ArrowStyle } from "./types";

export const DEFAULT_STYLE: Required<ArrowStyle> = {
  bend: 30,
  flip: false,
  strokeWidth: 1.5,
  dashed: false,
  headSize: 8,
  loopEnd: false,
};

/** Default target point: centre of the tutorial target. */
export function autoTargetPoint(): ArrowPoint {
  return { x: 50, y: 50 };
}

/**
 * Resolve a relative ArrowPoint (percentages) to absolute screen pixels.
 * Returns null if the target element is not currently mounted.
 */
export function resolvePoint(
  pt: ArrowPoint,
  targetSelector: string,
): { x: number; y: number } | null {
  const el = document.querySelector(
    `[data-tutorial-id="${targetSelector}"]`,
  );
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    x: r.left + r.width * (pt.x / 100),
    y: r.top + r.height * (pt.y / 100),
  };
}

/** Absolute pixel coordinates for the top-centre of the tutorial card. */
export function cardSourcePx(cardEl: HTMLElement): { x: number; y: number } {
  const r = cardEl.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top };
}

/**
 * Convert absolute screen pixels to a target-relative ArrowPoint.
 * Used by the drag handler to translate live mouse coordinates back into
 * the persistent relative representation.
 */
export function pixelToRelative(
  px: { x: number; y: number },
  targetSelector: string,
): ArrowPoint | null {
  const el = document.querySelector(
    `[data-tutorial-id="${targetSelector}"]`,
  );
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    x: Math.round(((px.x - r.left) / r.width) * 1000) / 10,
    y: Math.round(((px.y - r.top) / r.height) * 1000) / 10,
  };
}

/**
 * Build an SVG cubic-Bézier path from the tutorial card's top-centre to
 * the arrow tip. The curve bends perpendicular to the straight line by
 * `bend` % of the straight-line distance (clamped to a minimum of 20 px),
 * on the side dictated by the screen-space direction; `flip` mirrors
 * that choice.
 */
export function buildPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  style: Required<ArrowStyle>,
): string {
  const dx = tx - sx;
  const dy = ty - sy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const bend = Math.max(dist * (style.bend / 100), 20);
  const nx = -dy / (dist || 1);
  const ny = dx / (dist || 1);
  let sign = ny > 0 ? -1 : 1;
  if (style.flip) sign *= -1;
  const c1x = sx + dx * 0.25 + nx * bend * sign;
  const c1y = sy + dy * 0.25 + ny * bend * sign;
  const c2x = sx + dx * 0.75 + nx * bend * sign;
  const c2y = sy + dy * 0.75 + ny * bend * sign;
  return `M${sx},${sy} C${c1x},${c1y} ${c2x},${c2y} ${tx},${ty}`;
}
