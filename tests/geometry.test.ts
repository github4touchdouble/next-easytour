import { describe, expect, it } from "vitest";
import {
  buildPath,
  cardContainsPoint,
  DEFAULT_STYLE,
  nearestCardEdge,
  resolveStyle,
} from "../src/geometry";

describe("resolveStyle", () => {
  it("returns DEFAULT_STYLE when given nothing", () => {
    expect(resolveStyle()).toEqual(DEFAULT_STYLE);
  });

  it("merges a partial over the defaults", () => {
    const s = resolveStyle({ bend: 60, flip: true });
    expect(s).toEqual({ ...DEFAULT_STYLE, bend: 60, flip: true });
  });

  it("does not mutate DEFAULT_STYLE", () => {
    const snapshot = { ...DEFAULT_STYLE };
    resolveStyle({ bend: 99 });
    expect(DEFAULT_STYLE).toEqual(snapshot);
  });
});

describe("nearestCardEdge", () => {
  // 400×200 card at (100, 100).
  const card = { left: 100, top: 100, width: 400, height: 200 };
  const centreX = 300;
  const centreY = 200;
  const rightX = 500;
  const bottomY = 300;

  it("picks the right edge when target is to the right", () => {
    const edge = nearestCardEdge(card, { x: 900, y: 200 });
    expect(edge).toEqual({ x: rightX, y: centreY });
  });

  it("picks the left edge when target is to the left", () => {
    const edge = nearestCardEdge(card, { x: -200, y: 200 });
    expect(edge).toEqual({ x: 100, y: centreY });
  });

  it("picks the top edge when target is above", () => {
    const edge = nearestCardEdge(card, { x: 300, y: -50 });
    expect(edge).toEqual({ x: centreX, y: 100 });
  });

  it("picks the bottom edge when target is below", () => {
    const edge = nearestCardEdge(card, { x: 300, y: 900 });
    expect(edge).toEqual({ x: centreX, y: bottomY });
  });

  it("uses the dominant axis when both are large", () => {
    // dx = 600 (to the right), dy = 400 (below) — normalised by half-
    // width 200 vs half-height 100 → h-ratio 3.0, v-ratio 4.0.
    // Vertical dominates, so the edge should be the bottom.
    const edge = nearestCardEdge(card, { x: 900, y: 700 });
    expect(edge).toEqual({ x: centreX, y: bottomY });
  });
});

describe("cardContainsPoint", () => {
  const card = { left: 100, top: 100, width: 400, height: 200 };

  it("returns true for interior point", () => {
    expect(cardContainsPoint(card, { x: 300, y: 200 })).toBe(true);
  });

  it("returns true for corner point (inclusive)", () => {
    expect(cardContainsPoint(card, { x: 100, y: 100 })).toBe(true);
    expect(cardContainsPoint(card, { x: 500, y: 300 })).toBe(true);
  });

  it("returns false for exterior points", () => {
    expect(cardContainsPoint(card, { x: 50, y: 200 })).toBe(false);
    expect(cardContainsPoint(card, { x: 300, y: 50 })).toBe(false);
    expect(cardContainsPoint(card, { x: 600, y: 200 })).toBe(false);
    expect(cardContainsPoint(card, { x: 300, y: 400 })).toBe(false);
  });
});

describe("buildPath", () => {
  const style = DEFAULT_STYLE;

  it("emits a cubic Bézier with Move-Curveto structure", () => {
    const d = buildPath({ x: 100, y: 100 }, { x: 500, y: 300 }, style);
    expect(d).toMatch(/^M100,100 C[\d.,\s-]+ [\d.,\s-]+ 500,300$/);
  });

  it("ends at the tip exactly", () => {
    const d = buildPath({ x: 0, y: 0 }, { x: 123, y: 456 }, style);
    expect(d.endsWith(" 123,456")).toBe(true);
  });

  it("starts at the source exactly", () => {
    const d = buildPath({ x: 42, y: 99 }, { x: 200, y: 200 }, style);
    expect(d.startsWith("M42,99 C")).toBe(true);
  });

  it("doesn't explode for zero-length segments", () => {
    const d = buildPath({ x: 100, y: 100 }, { x: 100, y: 100 }, style);
    expect(d).toBeDefined();
    // Start and end are the same.
    expect(d.startsWith("M100,100")).toBe(true);
    expect(d.endsWith("100,100")).toBe(true);
  });

  it("flip reverses the bend direction", () => {
    const s = { x: 0, y: 0 };
    const t = { x: 200, y: 0 };
    const d1 = buildPath(s, t, style);
    const d2 = buildPath(s, t, { ...style, flip: true });
    // The two paths differ in the sign of the perpendicular offset.
    expect(d1).not.toEqual(d2);
  });
});