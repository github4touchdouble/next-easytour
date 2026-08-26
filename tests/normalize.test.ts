import { describe, expect, it } from "vitest";
import { normalizeStep, normalizeSteps, normalizeTutorial } from "../src";

// ────────────────────────────────────────────────────────────────────────
// Legacy 0.2 flat shape → 0.3+ nested shape
// ────────────────────────────────────────────────────────────────────────

describe("normalizeStep — legacy 0.2 fields", () => {
  it("lifts scalar `target` into `targets`", () => {
    expect(normalizeStep({ id: "a", target: "umap" }).targets).toEqual(["umap"]);
  });

  it("lifts arrowTo/arrowStyle/targetLabel into annotations.arrow", () => {
    const step = normalizeStep({
      id: "a",
      arrowTo: { x: 40, y: 60 },
      arrowStyle: { bend: 20, dashed: true },
      targetLabel: "here",
    });
    expect(step.annotations?.arrow).toEqual({
      to: { space: "target", x: 40, y: 60 },
      style: { bend: 20, dashed: true },
      label: "here",
    });
  });

  it("lifts circles and spotlight into annotations", () => {
    const step = normalizeStep({
      id: "a",
      circles: [{ x: 1, y: 2, r: 3 }],
      spotlight: true,
    });
    expect(step.annotations?.circles).toHaveLength(1);
    expect(step.annotations?.spotlight).toBe(true);
  });

  it("tags an untagged cardAnchor as a viewport anchor", () => {
    expect(normalizeStep({ id: "a", cardAnchor: { x: 10, y: 20 } }).cardAnchor)
      .toEqual({ space: "viewport", x: 10, y: 20 });
  });

  it("treats a string `highlight` as legacy host metadata, not a ring config", () => {
    const step = normalizeStep({ id: "a", highlight: "umap-panel" });
    expect(step.highlight).toBeUndefined();
    expect(step.meta).toEqual({ highlight: "umap-panel" });
  });

  it("keeps an object `highlight` as the 0.3 ring config", () => {
    const step = normalizeStep({ id: "a", highlight: { pulse: true } });
    expect(step.highlight).toEqual({ pulse: true });
    expect(step.meta).toBeUndefined();
  });

  it("synthesises an id from position when the entry has none", () => {
    expect(normalizeStep({ title: "x" }, 3).id).toBe("step-4");
  });

  it("synthesises an id when the entry is not an object at all", () => {
    expect(normalizeStep(null, 0).id).toBe("step-1");
  });
});

// ────────────────────────────────────────────────────────────────────────
// Metadata preservation
// ────────────────────────────────────────────────────────────────────────

describe("normalizeStep — host metadata", () => {
  it("moves unrecognised fields into meta rather than dropping them", () => {
    const step = normalizeStep({ id: "a", tumors: ["BRCA"], colorMode: "topo" });
    expect(step.meta).toEqual({ tumors: ["BRCA"], colorMode: "topo" });
  });

  it("merges loose fields with an existing meta, letting meta win", () => {
    const step = normalizeStep({ id: "a", colorMode: "topo", meta: { colorMode: "signature" } });
    expect(step.meta).toEqual({ colorMode: "signature" });
  });

  it("leaves meta unset when there is nothing to put in it", () => {
    expect(normalizeStep({ id: "a", title: "A" }).meta).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────────
// Idempotence — the property the editor's save/load cycle depends on
// ────────────────────────────────────────────────────────────────────────

describe("normalizeStep — idempotence", () => {
  const cases: Record<string, unknown> = {
    "legacy flat": {
      id: "a", title: "A", target: "umap",
      arrowTo: { x: 40, y: 60 }, arrowStyle: { bend: 20 },
      circles: [{ x: 1, y: 2, r: 3 }],
      cardAnchor: { x: 10, y: 20 },
      tumors: ["BRCA"],
    },
    "modern nested": {
      id: "a", title: "A", targets: ["umap"],
      annotations: {
        arrow: { to: { space: "target", x: 40, y: 60 }, style: { bend: 20 } },
        spotlight: true,
      },
      cardAnchor: { space: "viewport", x: 10, y: 20 },
      meta: { tumors: ["BRCA"] },
    },
    "sparse": { id: "a" },
  };

  for (const [name, raw] of Object.entries(cases)) {
    it(`re-normalising a ${name} step is a no-op`, () => {
      const once = normalizeStep(raw);
      const twice = normalizeStep(once as unknown);
      expect(twice).toEqual(once);
    });
  }

  it("round-trips through JSON unchanged", () => {
    const once = normalizeStep(cases["legacy flat"]);
    const roundTripped = normalizeStep(JSON.parse(JSON.stringify(once)));
    expect(roundTripped).toEqual(once);
  });
});

// ────────────────────────────────────────────────────────────────────────
// Whole-file payloads
// ────────────────────────────────────────────────────────────────────────

describe("normalizeTutorial", () => {
  it("accepts a bare array (the 0.2/0.3 on-disk format)", () => {
    const result = normalizeTutorial([{ id: "a" }, { id: "b" }]);
    expect(result.steps.map((s) => s.id)).toEqual(["a", "b"]);
    expect(result.version).toBe(1);
  });

  it("accepts a { steps, trigger } envelope", () => {
    const result = normalizeTutorial({
      steps: [{ id: "a" }],
      trigger: { text: "Go", mode: "annoying" },
    });
    expect(result.trigger).toEqual({ text: "Go", mode: "annoying" });
  });

  it("accepts `triggerConfig` as an alias for `trigger`", () => {
    expect(normalizeTutorial({ steps: [], triggerConfig: { text: "Go" } }).trigger)
      .toEqual({ text: "Go" });
  });

  it("returns an empty tutorial for null, undefined, or junk", () => {
    for (const raw of [null, undefined, 42 as unknown, "nope" as unknown]) {
      expect(normalizeSteps(raw as never)).toEqual([]);
    }
  });
});
