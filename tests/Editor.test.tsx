/**
 * @vitest-environment jsdom
 */
import { render, screen, act } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  Editor,
  Tutorial,
  useEditorState,
  useTutorial,
  targetPoint,
  type Step,
  type TargetPoint,
} from "../src";

// ────────────────────────────────────────────────────────────────────────
// Harness
// ────────────────────────────────────────────────────────────────────────

interface HarnessProps {
  steps: Step[];
  initialStepId?: string | null;
  canEdit?: boolean;
  onSave?: (steps: Step[]) => void | Promise<void>;
}

function Harness(props: HarnessProps) {
  const [stepId, setStepId] = useState<string | null>(
    props.initialStepId ?? null,
  );
  return (
    <Editor
      steps={props.steps}
      canEdit={props.canEdit}
      onSave={props.onSave}
    >
      {({ steps }) => (
        <Tutorial
          steps={steps}
          stepId={stepId}
          onStepChange={setStepId}
        >
          <EditorProbe />
          <TutorialProbe />
        </Tutorial>
      )}
    </Editor>
  );
}

function EditorProbe() {
  const state = useEditorState();
  if (!state) return <span data-testid="editor">no</span>;
  return (
    <>
      <span data-testid="editor-active">{String(state.active)}</span>
      <span data-testid="editor-unsaved">{state.unsavedCount}</span>
      <span data-testid="editor-status">{state.saveStatus}</span>
      <button data-testid="editor-save" onClick={() => void state.save()}>
        save
      </button>
      <button data-testid="editor-revert" onClick={state.revert}>
        revert
      </button>
    </>
  );
}

function TutorialProbe() {
  const { step } = useTutorial();
  return <span data-testid="step">{step?.id ?? "none"}</span>;
}

// ────────────────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────────────────

const baseSteps: Step[] = [
  { id: "a", title: "A", body: "body A" },
  { id: "b", title: "B", body: "body B" },
];

// ────────────────────────────────────────────────────────────────────────
// canEdit resolution
// ────────────────────────────────────────────────────────────────────────

describe("Editor — canEdit", () => {
  it("active=true when canEdit=true", () => {
    render(<Harness steps={baseSteps} canEdit={true} />);
    expect(screen.getByTestId("editor-active").textContent).toBe("true");
  });

  it("active=false when canEdit=false", () => {
    render(<Harness steps={baseSteps} canEdit={false} />);
    expect(screen.getByTestId("editor-active").textContent).toBe("false");
  });
});

// ────────────────────────────────────────────────────────────────────────
// Save / revert surface
// ────────────────────────────────────────────────────────────────────────

describe("Editor — save surface", () => {
  it("useEditorState returns a read-only snapshot", () => {
    render(<Harness steps={baseSteps} canEdit={true} />);
    expect(screen.getByTestId("editor-unsaved").textContent).toBe("0");
    expect(screen.getByTestId("editor-status").textContent).toBe("idle");
  });

  it("save() calls onSave with merged steps and transitions status", async () => {
    const onSave = vi.fn();
    render(<Harness steps={baseSteps} canEdit={true} onSave={onSave} />);

    await act(async () => {
      screen.getByTestId("editor-save").click();
    });

    // No overrides applied → merged steps === base steps (same
    // reference). Mock should have been called with the base list.
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toEqual(baseSteps);
    expect(screen.getByTestId("editor-status").textContent).toBe("saved");
  });

  it("save() surfaces error status when onSave throws", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("boom"));
    // Mock the clipboard fallback the Editor falls back to on error.
    const origClipboard = (navigator as unknown as { clipboard?: unknown })
      .clipboard;
    (navigator as unknown as { clipboard: unknown }).clipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };

    render(<Harness steps={baseSteps} canEdit={true} onSave={onSave} />);

    await act(async () => {
      screen.getByTestId("editor-save").click();
    });

    expect(screen.getByTestId("editor-status").textContent).toBe("error");
    (navigator as unknown as { clipboard?: unknown }).clipboard = origClipboard;
  });
});

// ────────────────────────────────────────────────────────────────────────
// Step merging — passes base steps through unchanged when no overrides
// ────────────────────────────────────────────────────────────────────────

describe("Editor — merging", () => {
  it("passes base steps through unchanged when no overrides exist", () => {
    // Typed as Step<unknown>[] because `useTutorial()` without an
    // explicit generic argument returns TutorialApi<unknown>.
    const captured: Step<unknown>[] = [];

    function Capturer() {
      const { step } = useTutorial();
      if (step) captured.push(step);
      return null;
    }

    function Inner() {
      const [stepId, setStepId] = useState<string | null>("a");
      return (
        <Editor steps={baseSteps} canEdit={true}>
          {({ steps }) => (
            <Tutorial
              steps={steps}
              stepId={stepId}
              onStepChange={setStepId}
            >
              <Capturer />
            </Tutorial>
          )}
        </Editor>
      );
    }

    render(<Inner />);
    // First render captured step "a" from the merged list.
    expect(captured[0]?.id).toBe("a");
    expect(captured[0]?.title).toBe("A");
    expect(captured[0]?.body).toBe("body A");
  });
});

// ────────────────────────────────────────────────────────────────────────
// useEditorState — mutator exposure (0.3.0-alpha.1)
// ────────────────────────────────────────────────────────────────────────
//
// alpha.0 returned only the read-only fields (active, unsavedCount,
// saveStatus, save, revert). alpha.1 additionally exposes the override
// mutators WHEN `active === true`, and leaves them `undefined` when
// inactive so the hook remains safe to call from read-only contexts.

describe("Editor — useEditorState mutator exposure (alpha.1)", () => {
  it("exposes mutators when the editor is active", () => {
    let shape: ReturnType<typeof useEditorState> = null;
    function Probe() {
      shape = useEditorState();
      return null;
    }
    render(
      <Editor steps={baseSteps} canEdit={true}>
        {() => (
          <Tutorial steps={baseSteps} stepId={null} onStepChange={() => {}}>
            <Probe />
          </Tutorial>
        )}
      </Editor>,
    );
    expect(shape).not.toBeNull();
    expect(shape!.active).toBe(true);
    expect(typeof shape!.setCardAnchor).toBe("function");
    expect(typeof shape!.clearCardAnchor).toBe("function");
    expect(typeof shape!.setArrowTip).toBe("function");
    expect(typeof shape!.setArrow).toBe("function");
    expect(typeof shape!.setCircles).toBe("function");
  });

  it("omits mutators when the editor is inactive", () => {
    let shape: ReturnType<typeof useEditorState> = null;
    function Probe() {
      shape = useEditorState();
      return null;
    }
    render(
      <Editor steps={baseSteps} canEdit={false}>
        {() => (
          <Tutorial steps={baseSteps} stepId={null} onStepChange={() => {}}>
            <Probe />
          </Tutorial>
        )}
      </Editor>,
    );
    expect(shape).not.toBeNull();
    expect(shape!.active).toBe(false);
    // Mutators must be undefined so read-only callers can rely on
    // `editor.setArrow?.(...)` chaining to no-op outside admin mode.
    expect(shape!.setCardAnchor).toBeUndefined();
    expect(shape!.clearCardAnchor).toBeUndefined();
    expect(shape!.setArrowTip).toBeUndefined();
    expect(shape!.setArrow).toBeUndefined();
    expect(shape!.setCircles).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────────
// Editor.setArrow — seeds targets + annotations.arrow atomically (alpha.1)
// ────────────────────────────────────────────────────────────────────────

describe("Editor — setArrow (alpha.1)", () => {
  /**
   * Shared helper: renders an <Editor> in active mode around a step
   * list and captures the merged step list on every render so tests
   * can assert the post-override shape.
   */
  function renderWithCapture(initialSteps: Step[]) {
    const captured: Step<unknown>[] = [];
    let api: ReturnType<typeof useEditorState> = null;

    function Capturer() {
      const { step } = useTutorial();
      if (step) captured.push(step);
      return null;
    }
    function Grab() {
      api = useEditorState();
      return null;
    }

    render(
      <Editor steps={initialSteps} canEdit={true}>
        {({ steps }) => (
          <Tutorial steps={steps} stepId="a" onStepChange={() => {}}>
            <Grab />
            <Capturer />
          </Tutorial>
        )}
      </Editor>,
    );

    return { captured, getApi: () => api! };
  }

  it("seeds both targets and annotations.arrow on a step that had neither", () => {
    const { captured, getApi } = renderWithCapture([
      { id: "a", title: "A" },
    ]);

    act(() => {
      getApi().setArrow!("a", {
        targets: ["umap-plot"],
        to: { space: "target", x: 50, y: 50 },
      });
    });

    const last = captured[captured.length - 1];
    expect(last.id).toBe("a");
    expect(last.targets).toEqual(["umap-plot"]);
    expect(last.annotations?.arrow?.to).toEqual({
      space: "target",
      x: 50,
      y: 50,
    });
  });

  it("appends new targets without duplicating existing ones", () => {
    const { captured, getApi } = renderWithCapture([
      { id: "a", title: "A", targets: ["existing"] },
    ]);

    act(() => {
      getApi().setArrow!("a", {
        targets: ["existing", "new-target"],
        to: { space: "target", x: 25, y: 75 },
      });
    });

    const last = captured[captured.length - 1];
    expect(last.targets).toEqual(["existing", "new-target"]);
  });

  it("carries style and label into the constructed arrow", () => {
    const { captured, getApi } = renderWithCapture([
      { id: "a", title: "A" },
    ]);

    act(() => {
      getApi().setArrow!("a", {
        targets: ["t"],
        to: targetPoint(10, 20),
        style: { bend: 50, dashed: true },
        label: "click me",
      });
    });

    const last = captured[captured.length - 1];
    expect(last.annotations?.arrow?.style).toEqual({ bend: 50, dashed: true });
    expect(last.annotations?.arrow?.label).toBe("click me");
  });
});

// ────────────────────────────────────────────────────────────────────────
// mergeOverrides — arrow-tip on a step without a prior arrow (alpha.1)
// ────────────────────────────────────────────────────────────────────────
//
// alpha.0: `if (arrowTipOverride && annotations.arrow)` meant an arrow-
// tip override on a step without an existing arrow was silently dropped.
// alpha.1: the merge constructs a minimal arrow annotation when the
// override exists but the step had none, so drag-to-create works
// through the editor's normal override channel.

describe("Editor — mergeOverrides arrow-from-nothing (alpha.1)", () => {
  it("constructs an arrow annotation when arrow-tip applied to a step with targets but no arrow", () => {
    const captured: Step<unknown>[] = [];
    let api: ReturnType<typeof useEditorState> = null;
    function Capturer() {
      const { step } = useTutorial();
      if (step) captured.push(step);
      return null;
    }
    function Grab() {
      api = useEditorState();
      return null;
    }
    const stepsWithTargetOnly: Step[] = [
      { id: "a", title: "A", targets: ["t"] },
    ];
    render(
      <Editor steps={stepsWithTargetOnly} canEdit={true}>
        {({ steps }) => (
          <Tutorial steps={steps} stepId="a" onStepChange={() => {}}>
            <Grab />
            <Capturer />
          </Tutorial>
        )}
      </Editor>,
    );

    const tip: TargetPoint = { space: "target", x: 75, y: 25 };
    act(() => {
      api!.setArrowTip!("a", tip);
    });

    const last = captured[captured.length - 1];
    expect(last.annotations?.arrow).toBeDefined();
    expect(last.annotations?.arrow?.to).toEqual(tip);
  });

  it("updates existing arrow's tip without clobbering style or label", () => {
    const captured: Step<unknown>[] = [];
    let api: ReturnType<typeof useEditorState> = null;
    function Capturer() {
      const { step } = useTutorial();
      if (step) captured.push(step);
      return null;
    }
    function Grab() {
      api = useEditorState();
      return null;
    }
    const stepsWithArrow: Step[] = [
      {
        id: "a",
        title: "A",
        targets: ["t"],
        annotations: {
          arrow: {
            to: { space: "target", x: 50, y: 50 },
            style: { bend: 30 },
            label: "keep me",
          },
        },
      },
    ];
    render(
      <Editor steps={stepsWithArrow} canEdit={true}>
        {({ steps }) => (
          <Tutorial steps={steps} stepId="a" onStepChange={() => {}}>
            <Grab />
            <Capturer />
          </Tutorial>
        )}
      </Editor>,
    );

    act(() => {
      api!.setArrowTip!("a", { space: "target", x: 10, y: 10 });
    });

    const last = captured[captured.length - 1];
    // Tip is the override, style and label survive.
    expect(last.annotations?.arrow?.to).toEqual({
      space: "target",
      x: 10,
      y: 10,
    });
    expect(last.annotations?.arrow?.style).toEqual({ bend: 30 });
    expect(last.annotations?.arrow?.label).toBe("keep me");
  });
});