/**
 * @vitest-environment jsdom
 */
import { render, screen, act, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  Card,
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

// ────────────────────────────────────────────────────────────────────────
// Card — default positioning (0.3.0-alpha.1)
// ────────────────────────────────────────────────────────────────────────
//
// alpha.0 default: bottom-centre for every step.
// alpha.1: bottom-centre when the step has targets (the arrow supplies
// the visual link to the UI); viewport-centre when the step has no
// targets (modal intro-card style).

describe("Card — default positioning (alpha.1)", () => {
  it("renders a targetless step centred in the viewport", () => {
    render(
      <Tutorial
        steps={[{ id: "a", title: "A" }]}
        stepId="a"
        onStepChange={() => {}}
      >
        <Card />
      </Tutorial>,
    );
    const card = document.querySelector(".eto-card") as HTMLElement;
    expect(card.style.position).toBe("fixed");
    expect(card.style.left).toBe("50%");
    expect(card.style.top).toBe("50%");
    expect(card.style.transform).toBe("translate(-50%, -50%)");
  });

  it("keeps bottom-centre default when the step has a target", () => {
    function TargetEl() {
      const ref = useTutorialTarget<HTMLDivElement>("t");
      return <div ref={ref}>t</div>;
    }
    render(
      <Tutorial
        steps={[{ id: "a", title: "A", targets: ["t"] }]}
        stepId="a"
        onStepChange={() => {}}
      >
        <TargetEl />
        <Card />
      </Tutorial>,
    );
    const card = document.querySelector(".eto-card") as HTMLElement;
    expect(card.style.position).toBe("fixed");
    expect(card.style.left).toBe("50%");
    expect(card.style.bottom).toBe("1.5rem");
    expect(card.style.transform).toBe("translateX(-50%)");
    // `top` must NOT be set — would conflict with `bottom`.
    expect(card.style.top).toBe("");
  });

  it("respects an explicit cardAnchor over either default", () => {
    render(
      <Tutorial
        steps={[
          {
            id: "a",
            title: "A",
            cardAnchor: { space: "viewport", x: 10, y: 20 },
          },
        ]}
        stepId="a"
        onStepChange={() => {}}
      >
        <Card />
      </Tutorial>,
    );
    const card = document.querySelector(".eto-card") as HTMLElement;
    expect(card.style.left).toBe("10vw");
    expect(card.style.top).toBe("20vh");
  });
});

// ────────────────────────────────────────────────────────────────────────
// Card — branded variant (0.3.0-alpha.1)
// ────────────────────────────────────────────────────────────────────────

describe("Card — branded variant (alpha.1)", () => {
  it("renders the branded DOM tree when variant='branded'", () => {
    render(
      <Tutorial
        steps={[{ id: "a", title: "Hello", body: "World" }]}
        stepId="a"
        onStepChange={() => {}}
      >
        <Card variant="branded" logo="/logo.svg" logoAlt="My product" />
      </Tutorial>,
    );
    const card = document.querySelector(".eto-card--branded");
    expect(card).not.toBeNull();
    expect(card!.querySelector(".eto-branded-header")).not.toBeNull();
    expect(card!.querySelector(".eto-branded-body")).not.toBeNull();
    expect(card!.querySelector(".eto-branded-title")?.textContent).toBe("Hello");
    expect(card!.querySelector(".eto-branded-copy")?.textContent).toBe("World");
    const img = card!.querySelector(".eto-branded-logo") as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe("/logo.svg");
    expect(img!.getAttribute("alt")).toBe("My product");
  });

  it("renders one dot per step with the active one marked", () => {
    render(
      <Tutorial
        steps={[
          { id: "a", title: "A" },
          { id: "b", title: "B" },
          { id: "c", title: "C" },
        ]}
        stepId="b"
        onStepChange={() => {}}
      >
        <Card variant="branded" />
      </Tutorial>,
    );
    const dots = document.querySelectorAll(".eto-branded-dot");
    expect(dots.length).toBe(3);
    expect(dots[1].classList.contains("eto-active")).toBe(true);
    expect(dots[0].classList.contains("eto-active")).toBe(false);
    expect(dots[2].classList.contains("eto-active")).toBe(false);
  });

  it("falls back to numeric progress for tours > 15 steps", () => {
    const manySteps: Step[] = Array.from({ length: 20 }, (_, i) => ({
      id: `s${i}`,
      title: `Step ${i}`,
    }));
    render(
      <Tutorial steps={manySteps} stepId="s5" onStepChange={() => {}}>
        <Card variant="branded" />
      </Tutorial>,
    );
    expect(document.querySelectorAll(".eto-branded-dot").length).toBe(0);
    expect(
      document.querySelector(".eto-branded-progress-numeric")?.textContent,
    ).toBe("6 / 20");
  });

  it("hideProgress suppresses both the dots and the numeric variant", () => {
    render(
      <Tutorial
        steps={[{ id: "a" }]}
        stepId="a"
        onStepChange={() => {}}
      >
        <Card variant="branded" hideProgress />
      </Tutorial>,
    );
    expect(document.querySelector(".eto-branded-progress")).toBeNull();
  });

  it("applies the accent override as an inline CSS variable", () => {
    render(
      <Tutorial steps={[{ id: "a" }]} stepId="a" onStepChange={() => {}}>
        <Card variant="branded" accent="#ff00ff" />
      </Tutorial>,
    );
    const card = document.querySelector(".eto-card--branded") as HTMLElement;
    expect(card.style.getPropertyValue("--eto-branded-accent")).toBe("#ff00ff");
  });

  it("localises Back / Next / Done / Close via the labels prop", () => {
    render(
      <Tutorial
        steps={[
          { id: "a", title: "A" },
          { id: "b", title: "B" },
        ]}
        stepId="b"
        onStepChange={() => {}}
      >
        <Card
          variant="branded"
          labels={{ back: "Retour", next: "Suivant", done: "Terminé", close: "Fermer" }}
        />
      </Tutorial>,
    );
    expect(
      document.querySelector(".eto-branded-btn-back")?.textContent,
    ).toBe("Retour");
    // Last step → Done label.
    expect(
      document.querySelector(".eto-branded-btn-next")?.textContent,
    ).toBe("Terminé");
    expect(
      document.querySelector(".eto-branded-close")?.getAttribute("aria-label"),
    ).toBe("Fermer");
  });
});

// ────────────────────────────────────────────────────────────────────────
// Card — Escape blurs focused element before close (0.3.0-alpha.1)
// ────────────────────────────────────────────────────────────────────────
//
// alpha.0: Escape called close() while focus remained on a descendant
// of the card; once the card unmounted, focus silently landed back on
// whatever the browser picked as a fallback — often a stale tour-
// originated button that had re-mounted. alpha.1 blurs the active
// element before calling close() to prevent the leak.

describe("Card — Escape blur behaviour (alpha.1)", () => {
  it("blurs the active element before invoking close()", () => {
    function Inner() {
      const [stepId, setStepId] = useState<string | null>("a");
      return (
        <Tutorial
          steps={[{ id: "a", title: "A" }]}
          stepId={stepId}
          onStepChange={setStepId}
        >
          <Card />
        </Tutorial>
      );
    }
    render(<Inner />);

    const closeButton = document.querySelector(".eto-close") as HTMLButtonElement;
    closeButton.focus();
    expect(document.activeElement).toBe(closeButton);

    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });

    expect(document.activeElement).not.toBe(closeButton);
  });
});