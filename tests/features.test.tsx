/**
 * @vitest-environment jsdom
 */
import { render, screen, act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  defineTutorial, TutorialProvider, TutorialStage, useTour,
  useTutorialFeature, useTutorialFeatures, useFeatureList,
  type Step, type TutorialFeature,
} from "../src";
import { resetFeatureWarningsForTests } from "../src/core/features";

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
  resetFeatureWarningsForTests();
});

afterEach(() => vi.unstubAllGlobals());

// ────────────────────────────────────────────────────────────────────────
// Harness — a miniature "app" the tour can drive
// ────────────────────────────────────────────────────────────────────────

const calls: string[] = [];

function Probe() {
  const tour = useTour();
  return (
    <>
      <span data-testid="loading">{String(tour.loading)}</span>
      <span data-testid="step">{tour.stepId ?? "none"}</span>
      <span data-testid="features">{tour.features.map((f) => f.name).join(",")}</span>
      <button data-testid="start" onClick={() => tour.start()}>start</button>
      <button data-testid="next" onClick={() => tour.start("two")}>two</button>
      <button data-testid="stop" onClick={tour.stop}>stop</button>
    </>
  );
}

/** The host component: owns state, and exposes it to tours by name. */
function Chart({ cleanup }: { cleanup?: () => void }) {
  const [mode, setMode] = React.useState("bars");
  const [selected, setSelected] = React.useState<string[]>([]);

  useTutorialFeature({
    name: "chart.setMode",
    label: "Set chart mode",
    description: "Switch between bar and line rendering.",
    params: [{ name: "mode", type: "enum", options: ["bars", "lines"] }],
    run: (m: string) => {
      calls.push(`setMode:${m}`);
      setMode(m);
      return cleanup;
    },
    read: () => mode,
    snapshot: () => mode,
    restore: (m) => { calls.push(`restoreMode:${m}`); setMode(m as string); },
  });

  useTutorialFeature({
    name: "chart.select",
    label: "Select series",
    params: [{ name: "keys", type: "string[]" }],
    run: (keys: string[]) => { calls.push(`select:${keys.join("|")}`); setSelected(keys); },
    read: () => selected.length,
    snapshot: () => selected,
    restore: (s) => setSelected(s as string[]),
  });

  return (
    <>
      <span data-testid="mode">{mode}</span>
      <span data-testid="selected">{selected.join(",")}</span>
    </>
  );
}

import * as React from "react";

const steps: Step[] = [
  {
    id: "one",
    title: "One",
    actions: [{ type: "feature", name: "chart.setMode", args: ["lines"] }],
  },
  {
    id: "two",
    title: "Two",
    actions: [{ type: "feature", name: "chart.select", args: [["a", "b"]] }],
  },
];

async function mount(node: React.ReactElement) {
  render(node);
  await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
}

function app(config = defineTutorial({ id: "feat", steps }), extra?: React.ReactNode) {
  return (
    <TutorialProvider config={config}>
      <Probe />
      <Chart />
      {extra}
      <TutorialStage />
    </TutorialProvider>
  );
}

beforeEach(() => { calls.length = 0; });

// ────────────────────────────────────────────────────────────────────────
// Registration & discovery
// ────────────────────────────────────────────────────────────────────────

describe("feature registration", () => {
  it("exposes registered features as plain data", async () => {
    await mount(app());
    await waitFor(() =>
      expect(screen.getByTestId("features").textContent).toBe("chart.select,chart.setMode"),
    );
  });

  it("describes a feature well enough for the editor to draw a form", async () => {
    let seen: ReturnType<typeof useFeatureList> = [];
    function Reader() { seen = useFeatureList(); return null; }
    await mount(app(undefined, <Reader />));

    await waitFor(() => expect(seen.length).toBe(2));
    const mode = seen.find((f) => f.name === "chart.setMode")!;
    expect(mode.label).toBe("Set chart mode");
    expect(mode.description).toMatch(/bar and line/);
    expect(mode.params[0]).toMatchObject({ name: "mode", type: "enum" });
    expect(mode).toMatchObject({ runnable: true, readable: true, restorable: true });
  });

  it("reports a feature with no handlers as neither runnable nor readable", async () => {
    let seen: ReturnType<typeof useFeatureList> = [];
    function Inert() {
      useTutorialFeature({ name: "inert" });
      seen = useFeatureList();
      return null;
    }
    await mount(app(undefined, <Inert />));
    await waitFor(() => expect(seen.some((f) => f.name === "inert")).toBe(true));
    expect(seen.find((f) => f.name === "inert")).toMatchObject({
      runnable: false, readable: false, restorable: false,
    });
  });

  it("unregisters when the owning component unmounts", async () => {
    function Toggle() {
      const [on, setOn] = React.useState(true);
      return (
        <>
          <button data-testid="hide" onClick={() => setOn(false)}>hide</button>
          {on && <Transient />}
        </>
      );
    }
    function Transient() {
      useTutorialFeature({ name: "transient", run: () => {} });
      return null;
    }
    await mount(app(undefined, <Toggle />));
    await waitFor(() =>
      expect(screen.getByTestId("features").textContent).toContain("transient"),
    );

    await act(async () => { screen.getByTestId("hide").click(); });
    await waitFor(() =>
      expect(screen.getByTestId("features").textContent).not.toContain("transient"),
    );
  });

  it("warns when a feature is registered with no provider to hold it", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    function Orphan() {
      useTutorialFeature({ name: "orphan", run: () => {} });
      return null;
    }
    render(<Orphan />);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/outside <TutorialProvider>/));
    warn.mockRestore();
  });

  it("registers a batch keyed by name", async () => {
    function Batch() {
      useTutorialFeatures({
        "batch.a": { run: () => {} },
        "batch.b": { run: () => {} },
      });
      return null;
    }
    await mount(app(undefined, <Batch />));
    await waitFor(() => {
      const names = screen.getByTestId("features").textContent!;
      expect(names).toContain("batch.a");
      expect(names).toContain("batch.b");
    });
  });
});

// ────────────────────────────────────────────────────────────────────────
// Invocation
// ────────────────────────────────────────────────────────────────────────

describe("feature actions", () => {
  it("drives host state when a step is entered", async () => {
    await mount(app());
    expect(screen.getByTestId("mode").textContent).toBe("bars");

    await act(async () => { screen.getByTestId("start").click(); });
    await waitFor(() => expect(screen.getByTestId("mode").textContent).toBe("lines"));
  });

  it("passes arguments through, including arrays", async () => {
    await mount(app());
    await act(async () => { screen.getByTestId("next").click(); });
    await waitFor(() => expect(screen.getByTestId("selected").textContent).toBe("a,b"));
  });

  it("invokes the newest definition, not the one captured at registration", async () => {
    // Features are written inline in render and close over current state;
    // registering the first object would call a stale closure forever.
    const seen: string[] = [];
    function Counter() {
      const [n, setN] = React.useState(0);
      useTutorialFeature({ name: "count.read", run: () => seen.push(`n=${n}`) });
      return <button data-testid="inc" onClick={() => setN(n + 1)}>inc</button>;
    }
    const config = defineTutorial({
      id: "fresh",
      steps: [{ id: "one", title: "One", actions: [{ type: "feature", name: "count.read" }] }],
    });
    await mount(
      <TutorialProvider config={config}>
        <Probe /><Counter /><TutorialStage />
      </TutorialProvider>,
    );

    await act(async () => { screen.getByTestId("inc").click(); });
    await act(async () => { screen.getByTestId("inc").click(); });
    await act(async () => { screen.getByTestId("start").click(); });

    await waitFor(() => expect(seen).toEqual(["n=2"]));
  });

  it("runs a feature's cleanup when the step is left", async () => {
    const cleanup = vi.fn();
    render(
      <TutorialProvider config={defineTutorial({ id: "cl", steps })}>
        <Probe /><Chart cleanup={cleanup} /><TutorialStage />
      </TutorialProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    await act(async () => { screen.getByTestId("start").click(); });
    await waitFor(() => expect(calls).toContain("setMode:lines"));

    await act(async () => { screen.getByTestId("next").click(); });
    await waitFor(() => expect(cleanup).toHaveBeenCalled());
  });

  it("names the available features when a step asks for one that is missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const config = defineTutorial({
      id: "typo",
      steps: [{ id: "one", title: "One", actions: [{ type: "feature", name: "chart.setMod" }] }],
    });
    await mount(app(config));
    await act(async () => { screen.getByTestId("start").click(); });

    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(/"chart\.setMod".*Available: chart\.select, chart\.setMode/s),
      ),
    );
    warn.mockRestore();
  });
});

// ────────────────────────────────────────────────────────────────────────
// Restoring the app afterwards
// ────────────────────────────────────────────────────────────────────────

describe("snapshot and restore", () => {
  it("puts host state back when the tour closes", async () => {
    await mount(app());
    expect(screen.getByTestId("mode").textContent).toBe("bars");

    await act(async () => { screen.getByTestId("start").click(); });
    await waitFor(() => expect(screen.getByTestId("mode").textContent).toBe("lines"));

    await act(async () => { screen.getByTestId("stop").click(); });
    await waitFor(() => expect(screen.getByTestId("mode").textContent).toBe("bars"));
  });

  it("restores the state from before the tour, not from the previous step", async () => {
    await mount(app());
    await act(async () => { screen.getByTestId("start").click(); });
    await act(async () => { screen.getByTestId("next").click(); });
    await waitFor(() => expect(screen.getByTestId("selected").textContent).toBe("a,b"));

    await act(async () => { screen.getByTestId("stop").click(); });
    await waitFor(() => expect(screen.getByTestId("selected").textContent).toBe(""));
    expect(screen.getByTestId("mode").textContent).toBe("bars");
  });

  it("can be switched off", async () => {
    const config = defineTutorial({
      id: "keep", steps, features: { restoreOnClose: false },
    });
    await mount(app(config));
    await act(async () => { screen.getByTestId("start").click(); });
    await waitFor(() => expect(screen.getByTestId("mode").textContent).toBe("lines"));

    await act(async () => { screen.getByTestId("stop").click(); });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByTestId("mode").textContent).toBe("lines");
  });

  it("keeps restoring the rest when one feature's restore throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    function Broken() {
      useTutorialFeature({
        name: "broken",
        snapshot: () => "x",
        restore: () => { throw new Error("boom"); },
      });
      return null;
    }
    await mount(app(undefined, <Broken />));
    await act(async () => { screen.getByTestId("start").click(); });
    await waitFor(() => expect(screen.getByTestId("mode").textContent).toBe("lines"));

    await act(async () => { screen.getByTestId("stop").click(); });
    await waitFor(() => expect(screen.getByTestId("mode").textContent).toBe("bars"));
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/restore of "broken"/), expect.anything());
    error.mockRestore();
  });
});

// ────────────────────────────────────────────────────────────────────────
// Waiting on a feature
// ────────────────────────────────────────────────────────────────────────

describe("waitFor a feature", () => {
  /** A host control that changes the state a step is waiting on. */
  function Selector() {
    const [sel, setSel] = React.useState<string[]>([]);
    useTutorialFeature({
      name: "sel.count",
      read: () => sel.length,
      run: (k: string[]) => setSel(k),
    });
    return <button data-testid="pick" onClick={() => setSel(["a"])}>pick</button>;
  }

  function Mode() {
    const [mode, setMode] = React.useState("bars");
    useTutorialFeature({ name: "mode.value", read: () => mode });
    return <button data-testid="to-lines" onClick={() => setMode("lines")}>lines</button>;
  }

  /** The card's forward button, whichever label it currently carries. */
  function forwardButton(): HTMLButtonElement {
    const btn = [...document.querySelectorAll<HTMLButtonElement>("button.eto-btn-primary")];
    return btn[btn.length - 1];
  }

  it("blocks the step until the host reports a truthy value", async () => {
    const config = defineTutorial({
      id: "wait",
      steps: [
        { id: "one", title: "One", waitFor: { type: "feature", name: "sel.count", pollMs: 10 } },
        { id: "two", title: "Two" },
      ],
    });
    render(
      <TutorialProvider config={config}>
        <Probe /><Selector /><TutorialStage />
      </TutorialProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    await act(async () => { screen.getByTestId("start").click(); });

    // Blocked: the card says so, and forward is disabled.
    await waitFor(() => expect(forwardButton().disabled).toBe(true));
    expect(forwardButton().textContent).toMatch(/Waiting/);

    await act(async () => { screen.getByTestId("pick").click(); });
    await waitFor(() => expect(forwardButton().disabled).toBe(false), { timeout: 3000 });
    expect(forwardButton().textContent).toMatch(/Next/);
  });

  it("matches an exact value when `equals` is given", async () => {
    const config = defineTutorial({
      id: "eq",
      steps: [
        {
          id: "one", title: "One",
          waitFor: { type: "feature", name: "mode.value", equals: "lines", pollMs: 10 },
        },
        { id: "two", title: "Two" },
      ],
    });
    render(
      <TutorialProvider config={config}>
        <Probe /><Mode /><TutorialStage />
      </TutorialProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    await act(async () => { screen.getByTestId("start").click(); });

    // "bars" is truthy, so a plain truthy check would have passed here —
    // `equals` is what makes this wait for the specific value.
    await waitFor(() => expect(forwardButton().disabled).toBe(true));

    await act(async () => { screen.getByTestId("to-lines").click(); });
    await waitFor(() => expect(forwardButton().disabled).toBe(false), { timeout: 3000 });
  });
});
