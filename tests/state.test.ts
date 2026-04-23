import { describe, expect, it } from "vitest";
import type { Step } from "../src/types";
import {
  computeClose,
  computeGoto,
  computeNext,
  computePrev,
  computeSnapshot,
  validateSteps,
} from "../src/core/state";

// ────────────────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────────────────

const threeSteps: Step[] = [
  { id: "a", title: "A", body: "..." },
  { id: "b", title: "B", body: "..." },
  { id: "c", title: "C", body: "..." },
];

// ────────────────────────────────────────────────────────────────────────
// computeSnapshot
// ────────────────────────────────────────────────────────────────────────

describe("computeSnapshot", () => {
  it("status=closed when stepId is null", () => {
    const snap = computeSnapshot({
      steps: threeSteps,
      stepId: null,
      transitioning: false,
      canAdvance: true,
      isWaiting: false,
    });
    expect(snap.status).toBe("closed");
    expect(snap.step).toBeNull();
    expect(snap.index).toBe(-1);
    expect(snap.isFirst).toBe(false);
    expect(snap.isLast).toBe(false);
  });

  it("status=running for a valid active step", () => {
    const snap = computeSnapshot({
      steps: threeSteps,
      stepId: "b",
      transitioning: false,
      canAdvance: true,
      isWaiting: false,
    });
    expect(snap.status).toBe("running");
    expect(snap.step?.id).toBe("b");
    expect(snap.index).toBe(1);
    expect(snap.total).toBe(3);
    expect(snap.isFirst).toBe(false);
    expect(snap.isLast).toBe(false);
  });

  it("isFirst true on the first step", () => {
    const snap = computeSnapshot({
      steps: threeSteps,
      stepId: "a",
      transitioning: false,
      canAdvance: true,
      isWaiting: false,
    });
    expect(snap.isFirst).toBe(true);
  });

  it("isLast true on the last step", () => {
    const snap = computeSnapshot({
      steps: threeSteps,
      stepId: "c",
      transitioning: false,
      canAdvance: true,
      isWaiting: false,
    });
    expect(snap.isLast).toBe(true);
  });

  it("status=transitioning overrides running", () => {
    const snap = computeSnapshot({
      steps: threeSteps,
      stepId: "b",
      transitioning: true,
      canAdvance: true,
      isWaiting: false,
    });
    expect(snap.status).toBe("transitioning");
  });

  it("status=blocked when canAdvance is false", () => {
    const snap = computeSnapshot({
      steps: threeSteps,
      stepId: "b",
      transitioning: false,
      canAdvance: false,
      isWaiting: false,
    });
    expect(snap.status).toBe("blocked");
    expect(snap.canAdvance).toBe(false);
  });

  it("unknown stepId falls back to closed", () => {
    const snap = computeSnapshot({
      steps: threeSteps,
      stepId: "nonexistent",
      transitioning: false,
      canAdvance: true,
      isWaiting: false,
    });
    // index is -1 (findIndex returned -1), step is null → closed.
    expect(snap.status).toBe("closed");
    expect(snap.step).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────
// computeNext
// ────────────────────────────────────────────────────────────────────────

describe("computeNext", () => {
  it("returns null when closed", () => {
    expect(
      computeNext({ steps: threeSteps, stepId: null, canAdvance: true }),
    ).toBeNull();
  });

  it("returns null when blocked", () => {
    expect(
      computeNext({ steps: threeSteps, stepId: "a", canAdvance: false }),
    ).toBeNull();
  });

  it("advances one step", () => {
    const intent = computeNext({
      steps: threeSteps,
      stepId: "a",
      canAdvance: true,
      isWaiting: false,
    });
    expect(intent).not.toBeNull();
    expect(intent!.toId).toBe("b");
    expect(intent!.kind).toBe("step");
    expect(intent!.leavingStep?.id).toBe("a");
    expect(intent!.enteringStep?.id).toBe("b");
  });

  it("closes on last step", () => {
    const intent = computeNext({
      steps: threeSteps,
      stepId: "c",
      canAdvance: true,
      isWaiting: false,
    });
    expect(intent).not.toBeNull();
    expect(intent!.toId).toBeNull();
    expect(intent!.kind).toBe("close");
    expect(intent!.leavingStep?.id).toBe("c");
    expect(intent!.enteringStep).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────
// computePrev
// ────────────────────────────────────────────────────────────────────────

describe("computePrev", () => {
  it("returns null when closed", () => {
    expect(
      computePrev({ steps: threeSteps, stepId: null, canAdvance: true }),
    ).toBeNull();
  });

  it("returns null at the first step (no escape backward)", () => {
    expect(
      computePrev({ steps: threeSteps, stepId: "a", canAdvance: true }),
    ).toBeNull();
  });

  it("steps back one", () => {
    const intent = computePrev({
      steps: threeSteps,
      stepId: "b",
      canAdvance: true,
      isWaiting: false,
    });
    expect(intent).not.toBeNull();
    expect(intent!.toId).toBe("a");
    expect(intent!.kind).toBe("step");
  });

  it("ignores canAdvance when going backward", () => {
    const intent = computePrev({
      steps: threeSteps,
      stepId: "c",
      canAdvance: false,
      isWaiting: false,
    });
    expect(intent).not.toBeNull();
    expect(intent!.toId).toBe("b");
  });
});

// ────────────────────────────────────────────────────────────────────────
// computeGoto
// ────────────────────────────────────────────────────────────────────────

describe("computeGoto", () => {
  it("returns null for unknown id", () => {
    expect(
      computeGoto({ steps: threeSteps, stepId: "a", canAdvance: true }, "xx"),
    ).toBeNull();
  });

  it("returns null when goto is called with the current id (no-op)", () => {
    expect(
      computeGoto({ steps: threeSteps, stepId: "a", canAdvance: true }, "a"),
    ).toBeNull();
  });

  it("opens the tour when closed", () => {
    const intent = computeGoto(
      { steps: threeSteps, stepId: null, canAdvance: true },
      "b",
    );
    expect(intent).not.toBeNull();
    expect(intent!.kind).toBe("open");
    expect(intent!.leavingStep).toBeNull();
    expect(intent!.enteringStep?.id).toBe("b");
  });

  it("jumps between active steps", () => {
    const intent = computeGoto(
      { steps: threeSteps, stepId: "a", canAdvance: true },
      "c",
    );
    expect(intent).not.toBeNull();
    expect(intent!.kind).toBe("step");
    expect(intent!.leavingStep?.id).toBe("a");
    expect(intent!.enteringStep?.id).toBe("c");
  });
});

// ────────────────────────────────────────────────────────────────────────
// computeClose
// ────────────────────────────────────────────────────────────────────────

describe("computeClose", () => {
  it("returns null when already closed", () => {
    expect(
      computeClose({ steps: threeSteps, stepId: null, canAdvance: true }),
    ).toBeNull();
  });

  it("closes from any active step", () => {
    const intent = computeClose({
      steps: threeSteps,
      stepId: "b",
      canAdvance: true,
      isWaiting: false,
    });
    expect(intent).not.toBeNull();
    expect(intent!.toId).toBeNull();
    expect(intent!.kind).toBe("close");
    expect(intent!.leavingStep?.id).toBe("b");
  });
});

// ────────────────────────────────────────────────────────────────────────
// validateSteps
// ────────────────────────────────────────────────────────────────────────

describe("validateSteps", () => {
  it("returns no warnings for a well-formed list", () => {
    expect(validateSteps(threeSteps)).toEqual([]);
  });

  it("warns on duplicate ids", () => {
    const warnings = validateSteps([
      { id: "a", title: "A", body: "1" },
      { id: "a", title: "A", body: "2" },
    ]);
    expect(warnings).toContain('duplicate step id: "a"');
  });

  it("warns on empty ids", () => {
    const warnings = validateSteps([{ id: "", title: "X", body: "Y" }]);
    expect(warnings[0]).toMatch(/no id/);
  });

  it("warns on empty content and no annotations", () => {
    const warnings = validateSteps([{ id: "empty" }]);
    expect(warnings[0]).toMatch(/neither content nor annotations/);
  });

  it("accepts a step with only annotations", () => {
    const warnings = validateSteps([
      { id: "a", annotations: { spotlight: true }, targets: ["x"] },
    ]);
    expect(warnings).toEqual([]);
  });

  it("accepts a step with content (JSX body)", () => {
    const warnings = validateSteps([
      { id: "a", content: "some jsx" },
    ]);
    expect(warnings).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────
// isWaiting (alpha.3)
// ────────────────────────────────────────────────────────────────────────

describe("computeSnapshot — isWaiting (alpha.3)", () => {
  it("status=waiting when isWaiting is true", () => {
    const snap = computeSnapshot({
      steps: threeSteps,
      stepId: "b",
      transitioning: false,
      canAdvance: true,
      isWaiting: true,
    });
    expect(snap.status).toBe("waiting");
    expect(snap.isWaiting).toBe(true);
    expect(snap.canAdvance).toBe(false); // blocked while waiting
  });

  it("canAdvance is false while waiting even if canAdvance input is true", () => {
    const snap = computeSnapshot({
      steps: threeSteps,
      stepId: "a",
      transitioning: false,
      canAdvance: true,
      isWaiting: true,
    });
    expect(snap.canAdvance).toBe(false);
  });

  it("transitioning takes priority over waiting", () => {
    const snap = computeSnapshot({
      steps: threeSteps,
      stepId: "b",
      transitioning: true,
      canAdvance: true,
      isWaiting: true,
    });
    expect(snap.status).toBe("transitioning");
  });

  it("isWaiting=false and canAdvance=false yields blocked (not waiting)", () => {
    const snap = computeSnapshot({
      steps: threeSteps,
      stepId: "b",
      transitioning: false,
      canAdvance: false,
      isWaiting: false,
    });
    expect(snap.status).toBe("blocked");
  });

  it("isWaiting=false leaves status as running", () => {
    const snap = computeSnapshot({
      steps: threeSteps,
      stepId: "b",
      transitioning: false,
      canAdvance: true,
      isWaiting: false,
    });
    expect(snap.status).toBe("running");
    expect(snap.isWaiting).toBe(false);
    expect(snap.canAdvance).toBe(true);
  });
});