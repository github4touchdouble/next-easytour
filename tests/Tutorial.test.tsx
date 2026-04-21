/**
 * @vitest-environment jsdom
 */
import { render, screen, act } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  Tutorial,
  useTutorial,
  useTutorialTarget,
  type Step,
} from "../src";

// ────────────────────────────────────────────────────────────────────────
// Harness — a tiny test component that exposes navigation via buttons
// ────────────────────────────────────────────────────────────────────────

interface HarnessProps {
  steps: Step[];
  initialStepId?: string | null;
  onOpen?: () => void;
  onClose?: () => void;
  onStepEnter?: (step: Step, index: number) => void;
  onStepLeave?: (step: Step, index: number) => void;
  canAdvance?: (step: Step, index: number) => boolean;
}

function Harness(props: HarnessProps) {
  const [stepId, setStepId] = useState<string | null>(
    props.initialStepId ?? null,
  );
  return (
    <Tutorial
      steps={props.steps}
      stepId={stepId}
      onStepChange={setStepId}
      onOpen={props.onOpen}
      onClose={props.onClose}
      onStepEnter={props.onStepEnter}
      onStepLeave={props.onStepLeave}
      canAdvance={props.canAdvance}
    >
      <Probe />
    </Tutorial>
  );
}

/** Reads tutorial state and exposes navigation through buttons. */
function Probe() {
  const api = useTutorial();
  return (
    <div>
      <span data-testid="status">{api.status}</span>
      <span data-testid="stepId">{api.step?.id ?? "none"}</span>
      <span data-testid="index">{api.index}</span>
      <span data-testid="total">{api.total}</span>
      <span data-testid="isFirst">{String(api.isFirst)}</span>
      <span data-testid="isLast">{String(api.isLast)}</span>
      <span data-testid="canAdvance">{String(api.canAdvance)}</span>
      <button data-testid="goto-a" onClick={() => api.goto("a")}>goto a</button>
      <button data-testid="goto-b" onClick={() => api.goto("b")}>goto b</button>
      <button data-testid="goto-c" onClick={() => api.goto("c")}>goto c</button>
      <button data-testid="next" onClick={api.next}>next</button>
      <button data-testid="prev" onClick={api.prev}>prev</button>
      <button data-testid="close" onClick={api.close}>close</button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────────────────

const threeSteps: Step[] = [
  { id: "a", title: "A" },
  { id: "b", title: "B" },
  { id: "c", title: "C" },
];

// ────────────────────────────────────────────────────────────────────────
// Initial render
// ────────────────────────────────────────────────────────────────────────

describe("Tutorial — initial state", () => {
  it("renders closed by default", () => {
    render(<Harness steps={threeSteps} />);
    expect(screen.getByTestId("status").textContent).toBe("closed");
    expect(screen.getByTestId("stepId").textContent).toBe("none");
    expect(screen.getByTestId("total").textContent).toBe("3");
  });

  it("renders running when given an initial stepId", () => {
    render(<Harness steps={threeSteps} initialStepId="b" />);
    expect(screen.getByTestId("status").textContent).toBe("running");
    expect(screen.getByTestId("stepId").textContent).toBe("b");
    expect(screen.getByTestId("index").textContent).toBe("1");
    expect(screen.getByTestId("isFirst").textContent).toBe("false");
    expect(screen.getByTestId("isLast").textContent).toBe("false");
  });

  it("throws when useTutorial is called outside <Tutorial>", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/useTutorial.*outside/);
    err.mockRestore();
  });
});

// ────────────────────────────────────────────────────────────────────────
// Navigation
// ────────────────────────────────────────────────────────────────────────

describe("Tutorial — navigation", () => {
  it("next() advances through steps and closes on the last", () => {
    render(<Harness steps={threeSteps} initialStepId="a" />);
    const next = screen.getByTestId("next");

    act(() => next.click());
    expect(screen.getByTestId("stepId").textContent).toBe("b");

    act(() => next.click());
    expect(screen.getByTestId("stepId").textContent).toBe("c");

    act(() => next.click());
    expect(screen.getByTestId("status").textContent).toBe("closed");
  });

  it("prev() is a no-op on the first step", () => {
    render(<Harness steps={threeSteps} initialStepId="a" />);
    act(() => screen.getByTestId("prev").click());
    expect(screen.getByTestId("stepId").textContent).toBe("a");
  });

  it("goto() jumps to any step by id", () => {
    render(<Harness steps={threeSteps} initialStepId="a" />);
    act(() => screen.getByTestId("goto-c").click());
    expect(screen.getByTestId("stepId").textContent).toBe("c");
    expect(screen.getByTestId("isLast").textContent).toBe("true");
  });

  it("close() transitions to closed", () => {
    render(<Harness steps={threeSteps} initialStepId="b" />);
    act(() => screen.getByTestId("close").click());
    expect(screen.getByTestId("status").textContent).toBe("closed");
  });
});

// ────────────────────────────────────────────────────────────────────────
// canAdvance gating
// ────────────────────────────────────────────────────────────────────────

describe("Tutorial — canAdvance", () => {
  it("sets status=blocked when the predicate returns false", () => {
    render(
      <Harness
        steps={threeSteps}
        initialStepId="b"
        canAdvance={() => false}
      />,
    );
    expect(screen.getByTestId("status").textContent).toBe("blocked");
    expect(screen.getByTestId("canAdvance").textContent).toBe("false");
  });

  it("next() is a no-op while blocked", () => {
    render(
      <Harness
        steps={threeSteps}
        initialStepId="a"
        canAdvance={(s) => s.id !== "a"}
      />,
    );
    act(() => screen.getByTestId("next").click());
    expect(screen.getByTestId("stepId").textContent).toBe("a");
  });

  it("prev() works even while blocked", () => {
    render(
      <Harness
        steps={threeSteps}
        initialStepId="b"
        canAdvance={() => false}
      />,
    );
    act(() => screen.getByTestId("prev").click());
    expect(screen.getByTestId("stepId").textContent).toBe("a");
  });
});

// ────────────────────────────────────────────────────────────────────────
// Lifecycle callback ordering
// ────────────────────────────────────────────────────────────────────────

describe("Tutorial — lifecycle callbacks", () => {
  it("fires onOpen + onStepEnter on open (in that order)", () => {
    const calls: string[] = [];
    render(
      <Harness
        steps={threeSteps}
        onOpen={() => calls.push("open")}
        onStepEnter={(s) => calls.push(`enter:${s.id}`)}
      />,
    );
    expect(calls).toEqual([]);
    act(() => screen.getByTestId("goto-b").click());
    // Effects flushed synchronously by act().
    expect(calls).toEqual(["open", "enter:b"]);
  });

  it("fires onStepLeave + onStepEnter on step change", () => {
    const calls: string[] = [];
    render(
      <Harness
        steps={threeSteps}
        initialStepId="a"
        onStepLeave={(s) => calls.push(`leave:${s.id}`)}
        onStepEnter={(s) => calls.push(`enter:${s.id}`)}
      />,
    );
    // Initial render fires enter:a.
    expect(calls).toContain("enter:a");
    calls.length = 0;

    act(() => screen.getByTestId("next").click());
    expect(calls).toEqual(["leave:a", "enter:b"]);
  });

  it("fires onStepLeave + onClose on close (in that order)", () => {
    const calls: string[] = [];
    render(
      <Harness
        steps={threeSteps}
        initialStepId="a"
        onStepLeave={(s) => calls.push(`leave:${s.id}`)}
        onClose={() => calls.push("close")}
      />,
    );
    calls.length = 0;
    act(() => screen.getByTestId("close").click());
    expect(calls).toEqual(["leave:a", "close"]);
  });

  it("does not crash when a lifecycle callback throws", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Harness
        steps={threeSteps}
        initialStepId="a"
        onStepEnter={() => {
          throw new Error("host bug");
        }}
      />,
    );
    // Tour still advances despite the throw.
    act(() => screen.getByTestId("next").click());
    expect(screen.getByTestId("stepId").textContent).toBe("b");
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

// ────────────────────────────────────────────────────────────────────────
// Target registration
// ────────────────────────────────────────────────────────────────────────

describe("useTutorialTarget", () => {
  function TargetHarness() {
    const ref = useTutorialTarget<HTMLButtonElement>("my-target");
    return <button ref={ref} data-testid="target">hi</button>;
  }

  it("logs a warning when used outside <Tutorial> in dev", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<TargetHarness />);
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/outside a <Tutorial>/),
    );
    warn.mockRestore();
  });

  it("registers the element inside <Tutorial> without warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <Tutorial
        steps={threeSteps}
        stepId={null}
        onStepChange={() => {}}
      >
        <TargetHarness />
      </Tutorial>,
    );
    // No "outside a <Tutorial>" warning should be emitted.
    const warningCalls = warn.mock.calls.filter((args) =>
      /outside a <Tutorial>/.test(String(args[0])),
    );
    expect(warningCalls.length).toBe(0);
    warn.mockRestore();
  });
});