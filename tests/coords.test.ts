import { describe, expect, it } from "vitest";
import {
  clampViewportAnchor,
  DEFAULT_TARGET_POINT,
  pxToTargetPoint,
  pxToViewportAnchor,
  targetPoint,
  targetPointToPx,
  viewportAnchor,
  viewportAnchorToPx,
} from "../src/coords";

describe("constructors", () => {
  it("targetPoint() stamps the discriminator", () => {
    const p = targetPoint(50, 90);
    expect(p).toEqual({ space: "target", x: 50, y: 90 });
  });

  it("viewportAnchor() stamps the discriminator", () => {
    const a = viewportAnchor(10, 20);
    expect(a).toEqual({ space: "viewport", x: 10, y: 20 });
  });

  it("DEFAULT_TARGET_POINT sits near the target's bottom-centre", () => {
    expect(DEFAULT_TARGET_POINT).toEqual({ space: "target", x: 50, y: 90 });
  });
});

describe("target-relative ↔ pixel round-trips", () => {
  const rect = { left: 100, top: 200, width: 400, height: 300 };

  it("targetPointToPx resolves centre", () => {
    const px = targetPointToPx(targetPoint(50, 50), rect);
    expect(px).toEqual({ x: 300, y: 350 });
  });

  it("targetPointToPx handles values outside 0–100", () => {
    // (150, -10) → 10% beyond the bottom-right axis, 10% above the top.
    const px = targetPointToPx(targetPoint(150, -10), rect);
    expect(px).toEqual({ x: 700, y: 170 });
  });

  it("targetPointToPx returns null on zero-area targets", () => {
    expect(
      targetPointToPx(targetPoint(50, 50), {
        left: 0,
        top: 0,
        width: 0,
        height: 0,
      }),
    ).toBeNull();
  });

  it("pxToTargetPoint inverts targetPointToPx", () => {
    const original = targetPoint(37.5, 62.5);
    const px = targetPointToPx(original, rect)!;
    const roundTripped = pxToTargetPoint(px, rect);
    expect(roundTripped).toEqual(original);
  });

  it("pxToTargetPoint rounds to 0.1% precision", () => {
    const p = pxToTargetPoint({ x: 100 + 123.456, y: 200 + 111.111 }, rect)!;
    // 123.456 / 400 * 100 = 30.864 → rounds to 30.9
    expect(p.x).toBeCloseTo(30.9, 1);
    // 111.111 / 300 * 100 = 37.037 → rounds to 37.0
    expect(p.y).toBeCloseTo(37.0, 1);
  });

  it("pxToTargetPoint returns null on zero-dimension rects", () => {
    expect(
      pxToTargetPoint(
        { x: 0, y: 0 },
        { left: 0, top: 0, width: 0, height: 100 },
      ),
    ).toBeNull();
  });
});

describe("viewport anchor ↔ pixel round-trips", () => {
  const viewport = { width: 1280, height: 720 };

  it("viewportAnchorToPx resolves centre", () => {
    expect(viewportAnchorToPx(viewportAnchor(50, 50), viewport)).toEqual({
      x: 640,
      y: 360,
    });
  });

  it("pxToViewportAnchor inverts", () => {
    const px = { x: 640, y: 360 };
    const a = pxToViewportAnchor(px, viewport);
    expect(a.x).toBeCloseTo(50, 1);
    expect(a.y).toBeCloseTo(50, 1);
  });

  it("pxToViewportAnchor rounds to 0.01%", () => {
    // 12.345 / 1280 * 100 = 0.9644... → rounds to 0.96
    const a = pxToViewportAnchor({ x: 12.345, y: 0 }, viewport);
    expect(a.x).toBeCloseTo(0.96, 2);
  });
});

describe("clampViewportAnchor", () => {
  const viewport = { width: 1280, height: 720 };
  const element = { width: 480, height: 200 };

  it("leaves an in-bounds anchor untouched", () => {
    const a = viewportAnchor(40, 50);
    const clamped = clampViewportAnchor(a, element, viewport);
    expect(clamped.x).toBe(40);
    expect(clamped.y).toBe(50);
  });

  it("clamps x below zero but allows negative within keep-visible margin", () => {
    // keep-visible 24 px; element 480 px wide; viewport 1280 px.
    // min x = -((480 - 24) / 1280) * 100 = -35.625%
    const a = viewportAnchor(-200, 50);
    const clamped = clampViewportAnchor(a, element, viewport);
    expect(clamped.x).toBeCloseTo(-35.625, 3);
  });

  it("clamps x at the right edge", () => {
    // max x = ((1280 - 24) / 1280) * 100 = 98.125%
    const a = viewportAnchor(200, 50);
    const clamped = clampViewportAnchor(a, element, viewport);
    expect(clamped.x).toBeCloseTo(98.125, 3);
  });

  it("clamps y to [0, (vh - keep)/vh * 100]", () => {
    const top = clampViewportAnchor(viewportAnchor(50, -50), element, viewport);
    expect(top.y).toBe(0);
    const bottom = clampViewportAnchor(
      viewportAnchor(50, 200),
      element,
      viewport,
    );
    // max y = ((720 - 24) / 720) * 100 = 96.666...
    expect(bottom.y).toBeCloseTo(96.667, 2);
  });
});