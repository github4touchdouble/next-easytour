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
  type Step,
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