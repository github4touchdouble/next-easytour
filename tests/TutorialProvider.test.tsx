/**
 * @vitest-environment jsdom
 */
import { render, screen, act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  defineTutorial, staticStore, localStore, TourTrigger, TutorialProvider,
  TutorialStage, useTour, type Step, type TutorialStore,
} from "../src";

// ────────────────────────────────────────────────────────────────────────
// Environment
// ────────────────────────────────────────────────────────────────────────

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => { map.clear(); },
  } as Storage;
}

/** Report a fixed answer for every media query. */
function stubMatchMedia(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches, media: query,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {},
    onchange: null, dispatchEvent: () => false,
  }));
}

beforeEach(() => {
  stubMatchMedia(true);
  Object.defineProperty(window, "localStorage", {
    value: memoryStorage(), configurable: true, writable: true,
  });
  // useTutorialDone persists via cookie; clear between tests.
  for (const c of document.cookie.split("; ")) {
    const name = c.split("=")[0];
    if (name) document.cookie = `${name}=; max-age=0; path=/`;
  }
});

afterEach(() => vi.unstubAllGlobals());

// ────────────────────────────────────────────────────────────────────────
// Harness
// ────────────────────────────────────────────────────────────────────────

const steps: Step[] = [
  { id: "a", title: "A", body: "body A" },
  { id: "b", title: "B", body: "body B" },
];

function Probe() {
  const tour = useTour();
  return (
    <>
      <span data-testid="step">{tour.stepId ?? "none"}</span>
      <span data-testid="loading">{String(tour.loading)}</span>
      <span data-testid="available">{String(tour.available)}</span>
      <span data-testid="done">{String(tour.done)}</span>
      <span data-testid="count">{tour.steps.length}</span>
      <span data-testid="editing">{String(tour.editor.active)}</span>
      <button data-testid="start" onClick={() => tour.start()}>start</button>
      <button data-testid="start-b" onClick={() => tour.start("b")}>start b</button>
      <button data-testid="stop" onClick={tour.stop}>stop</button>
      <button data-testid="unlock" onClick={tour.editor.unlock}>unlock</button>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Loading
// ────────────────────────────────────────────────────────────────────────

describe("TutorialProvider — loading", () => {
  it("loads steps from the store and reports availability", async () => {
    const config = defineTutorial({ id: "t", steps });
    render(<TutorialProvider config={config}><Probe /></TutorialProvider>);

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("count").textContent).toBe("2");
    expect(screen.getByTestId("available").textContent).toBe("true");
  });

  it("is unavailable when the store loads no steps", async () => {
    const config = defineTutorial({ id: "t", steps: [] });
    render(<TutorialProvider config={config}><Probe /></TutorialProvider>);
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("available").textContent).toBe("false");
  });

  it("is unavailable — and does not throw — when the store fails", async () => {
    const failing: TutorialStore = {
      name: "broken", readonly: true,
      load: async () => { throw new Error("network down"); },
    };
    const config = defineTutorial({ id: "t", store: failing });
    render(<TutorialProvider config={config}><Probe /><TutorialStage /></TutorialProvider>);

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("available").textContent).toBe("false");
  });
});

// ────────────────────────────────────────────────────────────────────────
// Navigation
// ────────────────────────────────────────────────────────────────────────

describe("TutorialProvider — navigation", () => {
  async function mounted(config = defineTutorial({ id: "t", steps })) {
    render(<TutorialProvider config={config}><Probe /><TutorialStage /></TutorialProvider>);
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
  }

  it("opens at the first step by default", async () => {
    await mounted();
    act(() => screen.getByTestId("start").click());
    expect(screen.getByTestId("step").textContent).toBe("a");
  });

  it("opens at an explicit step", async () => {
    await mounted();
    act(() => screen.getByTestId("start-b").click());
    expect(screen.getByTestId("step").textContent).toBe("b");
  });

  it("closes", async () => {
    await mounted();
    act(() => screen.getByTestId("start").click());
    act(() => screen.getByTestId("stop").click());
    expect(screen.getByTestId("step").textContent).toBe("none");
  });

  it("renders the card only once open", async () => {
    await mounted();
    expect(screen.queryAllByText("body A")).toHaveLength(0);
    act(() => screen.getByTestId("start").click());
    // <Card> also pre-measures every step in a hidden container to keep
    // its height stable, so the body text legitimately appears twice.
    expect(screen.queryAllByText("body A").length).toBeGreaterThan(0);
  });

  it("closes itself when the open step disappears from the store", async () => {
    // A step deleted in the editor, or a reload that returns a shorter
    // list, must not leave the tour stranded on a missing step.
    let current: Step[] = steps;
    const store: TutorialStore = {
      name: "mutable", readonly: true,
      load: async () => ({ steps: current, version: 1 }),
    };
    const config = defineTutorial({ id: "t", store });

    function Reloader() {
      const tour = useTour();
      return <button data-testid="reload" onClick={tour.reload}>reload</button>;
    }

    render(
      <TutorialProvider config={config}>
        <Probe /><Reloader /><TutorialStage />
      </TutorialProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    act(() => screen.getByTestId("start-b").click());
    expect(screen.getByTestId("step").textContent).toBe("b");

    current = [steps[0]];
    await act(async () => { screen.getByTestId("reload").click(); });

    await waitFor(() => expect(screen.getByTestId("step").textContent).toBe("none"));
  });
});

// ────────────────────────────────────────────────────────────────────────
// Media gate
// ────────────────────────────────────────────────────────────────────────

describe("TutorialProvider — media gate", () => {
  it("is unavailable when minWidth does not match", async () => {
    stubMatchMedia(false);
    const config = defineTutorial({ id: "t", steps, minWidth: 768 });
    render(<TutorialProvider config={config}><Probe /><TutorialStage /></TutorialProvider>);

    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("available").textContent).toBe("false");
    expect(screen.queryByText("body A")).toBeNull();
  });

  it("is unavailable when `enabled` is false", async () => {
    const config = defineTutorial({ id: "t", steps, enabled: false });
    render(<TutorialProvider config={config}><Probe /></TutorialProvider>);
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("available").textContent).toBe("false");
  });
});

// ────────────────────────────────────────────────────────────────────────
// Completion
// ────────────────────────────────────────────────────────────────────────

describe("TutorialProvider — completion", () => {
  it("marks done on reaching the last step, by default", async () => {
    const config = defineTutorial({ id: "t", steps });
    render(<TutorialProvider config={config}><Probe /><TutorialStage /></TutorialProvider>);
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    expect(screen.getByTestId("done").textContent).toBe("false");
    act(() => screen.getByTestId("start-b").click());
    await waitFor(() => expect(screen.getByTestId("done").textContent).toBe("true"));
  });

  it("does not mark done on an earlier step", async () => {
    const config = defineTutorial({ id: "t", steps });
    render(<TutorialProvider config={config}><Probe /><TutorialStage /></TutorialProvider>);
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    act(() => screen.getByTestId("start").click());
    expect(screen.getByTestId("done").textContent).toBe("false");
  });

  it("withholds completion until close when markOn is 'finish'", async () => {
    const config = defineTutorial({
      id: "t-finish", steps, completion: { markOn: "finish" },
    });
    render(<TutorialProvider config={config}><Probe /><TutorialStage /></TutorialProvider>);
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    act(() => screen.getByTestId("start-b").click());
    expect(screen.getByTestId("done").textContent).toBe("false");

    act(() => screen.getByTestId("stop").click());
    await waitFor(() => expect(screen.getByTestId("done").textContent).toBe("true"));
  });

  it("derives the cookie name from the tutorial id", () => {
    expect(defineTutorial({ id: "onboarding", steps }).completion)
      .toEqual({ key: "onboarding-done", markOn: "last-step" });
  });
});

// ────────────────────────────────────────────────────────────────────────
// Trigger
// ────────────────────────────────────────────────────────────────────────

describe("TourTrigger", () => {
  it("renders the configured text and starts the tour", async () => {
    const config = defineTutorial({ id: "t", steps, trigger: { text: "Take the tour" } });
    render(
      <TutorialProvider config={config}>
        <Probe /><TourTrigger /><TutorialStage />
      </TutorialProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    const button = screen.getByText("Take the tour");
    act(() => button.click());
    expect(screen.getByTestId("step").textContent).toBe("a");
  });

  it("hides itself while the tour is open", async () => {
    const config = defineTutorial({ id: "t", steps, trigger: { text: "Take the tour" } });
    render(
      <TutorialProvider config={config}>
        <Probe /><TourTrigger /><TutorialStage />
      </TutorialProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    act(() => screen.getByTestId("start").click());
    expect(screen.queryByText("Take the tour")).toBeNull();
  });

  it("does not render when the tour is unavailable", async () => {
    stubMatchMedia(false);
    const config = defineTutorial({
      id: "t", steps, minWidth: 768, trigger: { text: "Take the tour" },
    });
    render(
      <TutorialProvider config={config}><Probe /><TourTrigger /></TutorialProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.queryByText("Take the tour")).toBeNull();
  });

  it("prefers a trigger config saved in the store over the one in code", async () => {
    // The 0.3 round-trip was broken here: the editor could save a
    // trigger config that the button never read back.
    const store: TutorialStore = {
      name: "with-trigger", readonly: true,
      load: async () => ({ steps, trigger: { text: "Saved label" }, version: 1 }),
    };
    const config = defineTutorial({ id: "t", store, trigger: { text: "Code label" } });
    render(
      <TutorialProvider config={config}><Probe /><TourTrigger /></TutorialProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    expect(screen.getByText("Saved label")).toBeTruthy();
    expect(screen.queryByText("Code label")).toBeNull();
  });

  it("lets an explicit prop override both", async () => {
    const config = defineTutorial({ id: "t", steps, trigger: { text: "Config label" } });
    render(
      <TutorialProvider config={config}><Probe /><TourTrigger text="Local label" /></TutorialProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByText("Local label")).toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────────────────
// Editor permission
// ────────────────────────────────────────────────────────────────────────

describe("TutorialStage — editor permission", () => {
  async function mount(node: React.ReactElement) {
    render(node);
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
  }

  it("does not activate the editor without permission", async () => {
    const config = defineTutorial({ id: "t", steps });
    await mount(
      <TutorialProvider config={config}><Probe /><TutorialStage /></TutorialProvider>,
    );
    act(() => screen.getByTestId("start").click());
    expect(screen.getByTestId("editing").textContent).toBe("false");
  });

  it("still requires an unlock from an allowed user", async () => {
    const config = defineTutorial({
      id: "t", store: localStore("t", { fallback: steps }),
      editor: { permission: { allow: true } },
    });
    await mount(
      <TutorialProvider config={config}><Probe /><TutorialStage /></TutorialProvider>,
    );
    expect(screen.getByTestId("editing").textContent).toBe("false");

    act(() => screen.getByTestId("unlock").click());
    expect(screen.getByTestId("editing").textContent).toBe("true");
  });

  it("activates immediately when no unlock is required", async () => {
    const config = defineTutorial({
      id: "t", store: localStore("t", { fallback: steps }),
      editor: { permission: { allow: true, requireUnlock: false } },
    });
    await mount(
      <TutorialProvider config={config}><Probe /><TutorialStage /></TutorialProvider>,
    );
    expect(screen.getByTestId("editing").textContent).toBe("true");
  });

  it("lets the canEdit prop override the config's allow", async () => {
    // The seam that keeps a module-scope config static while the host's
    // auth stays reactive.
    const config = defineTutorial({
      id: "t", store: localStore("t", { fallback: steps }),
      editor: { permission: { allow: false, requireUnlock: false } },
    });
    await mount(
      <TutorialProvider config={config} canEdit>
        <Probe /><TutorialStage />
      </TutorialProvider>,
    );
    expect(screen.getByTestId("editing").textContent).toBe("true");
  });

  it("denies editing when canEdit is false, whatever the config says", async () => {
    const config = defineTutorial({
      id: "t", store: localStore("t", { fallback: steps }),
      editor: { permission: { allow: true, requireUnlock: false } },
    });
    await mount(
      <TutorialProvider config={config} canEdit={false}>
        <Probe /><TutorialStage />
      </TutorialProvider>,
    );
    expect(screen.getByTestId("editing").textContent).toBe("false");
  });
});
