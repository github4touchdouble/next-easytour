/**
 * @vitest-environment jsdom
 */
import { render, screen, act, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  defineTutorial, localStore, TourTrigger, TutorialProvider,
  TutorialStage, useTour, type Step,
} from "../src";

const steps: Step[] = [
  { id: "a", title: "A", body: "body A" },
  { id: "b", title: "B", body: "body B" },
];

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
    value: {
      getItem: () => null, setItem: () => {}, removeItem: () => {},
      clear: () => {}, key: () => null, length: 0,
    } as Storage,
    configurable: true, writable: true,
  });
  // jsdom reports a zero rect for everything; give the seam something to
  // measure so it commits a rect instead of bailing out.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    left: 10, top: 20, width: 120, height: 32,
    right: 130, bottom: 52, x: 10, y: 20, toJSON: () => ({}),
  } as DOMRect);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function Probe() {
  const tour = useTour();
  return (
    <>
      <span data-testid="loading">{String(tour.loading)}</span>
      <span data-testid="editing">{String(tour.editor.active)}</span>
      <button data-testid="unlock" onClick={tour.editor.unlock}>unlock</button>
      <button data-testid="lock" onClick={tour.editor.lock}>lock</button>
      <button data-testid="start" onClick={() => tour.start()}>start</button>
    </>
  );
}

function seam() {
  return document.querySelector(".eto-seam");
}

async function mount(canEdit: boolean) {
  const config = defineTutorial({
    id: "seam-test",
    store: localStore("seam-test", { fallback: steps }),
    trigger: { text: "Start Tour" },
    editor: { permission: { allow: canEdit } },
  });
  render(
    <TutorialProvider config={config}>
      <Probe /><TourTrigger /><TutorialStage />
    </TutorialProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
}

describe("EditorSeam", () => {
  it("is absent while the editor is locked", async () => {
    await mount(true);
    expect(screen.getByText("Start Tour")).toBeTruthy();
    expect(seam()).toBeNull();
  });

  it("appears around the trigger once the editor is unlocked", async () => {
    await mount(true);
    await act(async () => { screen.getByTestId("unlock").click(); });
    await waitFor(() => expect(seam()).not.toBeNull(), { timeout: 15000 });
  });

  it("is labelled so an author knows what the seam belongs to", async () => {
    await mount(true);
    await act(async () => { screen.getByTestId("unlock").click(); });
    await waitFor(() => expect(seam()).not.toBeNull(), { timeout: 15000 });
    expect(seam()!.querySelector(".eto-seam-badge")?.textContent).toBe("next-easytour");
  });

  it("tracks the trigger's rect, with padding on every side", async () => {
    await mount(true);
    await act(async () => { screen.getByTestId("unlock").click(); });
    await waitFor(() => expect(seam()).not.toBeNull(), { timeout: 15000 });

    // Trigger rect is 10,20 120x32; default padding is 6.
    const style = (seam() as HTMLElement).style;
    expect(style.left).toBe("4px");
    expect(style.top).toBe("14px");
    expect(style.width).toBe("132px");
    expect(style.height).toBe("44px");
  });

  it("is inert: hidden from assistive tech, and not a click target", async () => {
    await mount(true);
    await act(async () => { screen.getByTestId("unlock").click(); });
    await waitFor(() => expect(seam()).not.toBeNull(), { timeout: 15000 });

    expect(seam()!.getAttribute("aria-hidden")).toBe("true");
    // jsdom does not load the stylesheet, so the pointer-events guarantee
    // is asserted against the rule itself.
    const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf-8");
    const rule = css.slice(css.indexOf(".eto-seam {"), css.indexOf("}", css.indexOf(".eto-seam {")));
    expect(rule).toMatch(/pointer-events:\s*none/);
  });

  it("retracts when the editor is locked again", async () => {
    await mount(true);
    await act(async () => { screen.getByTestId("unlock").click(); });
    await waitFor(() => expect(seam()).not.toBeNull(), { timeout: 15000 });

    await act(async () => { screen.getByTestId("lock").click(); });
    await waitFor(() => expect(seam()).toBeNull());
  });

  it("retracts when the tour opens and the trigger unmounts", async () => {
    await mount(true);
    await act(async () => { screen.getByTestId("unlock").click(); });
    await waitFor(() => expect(seam()).not.toBeNull(), { timeout: 15000 });

    await act(async () => { screen.getByTestId("start").click(); });
    await waitFor(() => expect(seam()).toBeNull());
  });

  it("never appears for a user who may not edit", async () => {
    await mount(false);
    await act(async () => { screen.getByTestId("unlock").click(); });
    expect(screen.getByTestId("editing").textContent).toBe("false");
    expect(seam()).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────
// Entry-point principle
// ────────────────────────────────────────────────────────────────────────

describe("entry-point warning", () => {
  async function mountWith(
    node: React.ReactElement,
  ): Promise<ReturnType<typeof vi.spyOn>> {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(node);
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    // The warning is deferred a turn so a trigger mounting in the same
    // commit can register first; outlast that before asserting silence.
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    return warn;
  }

  const noEntry = (
    <TutorialProvider config={defineTutorial({ id: "no-entry", steps })}>
      <Probe />
      <TutorialStage />
    </TutorialProvider>
  );

  it("warns when nothing can open the tour", async () => {
    const warn = await mountWith(noEntry);
    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/has no entry point/)),
    );
  });

  it("stays quiet when a TourTrigger is mounted", async () => {
    const warn = await mountWith(
      <TutorialProvider config={defineTutorial({ id: "with-trigger", steps })}>
        <Probe /><TourTrigger /><TutorialStage />
      </TutorialProvider>,
    );
    expect(warn).not.toHaveBeenCalledWith(expect.stringMatching(/has no entry point/));
  });

  it("stays quiet when autoStart opens the tour", async () => {
    const warn = await mountWith(
      <TutorialProvider config={defineTutorial({ id: "auto", steps, autoStart: true })}>
        <Probe /><TutorialStage />
      </TutorialProvider>,
    );
    expect(warn).not.toHaveBeenCalledWith(expect.stringMatching(/has no entry point/));
  });

  it('stays quiet when the host declares entryPoint: "custom"', async () => {
    const warn = await mountWith(
      <TutorialProvider config={defineTutorial({ id: "custom", steps, entryPoint: "custom" })}>
        <Probe /><TutorialStage />
      </TutorialProvider>,
    );
    expect(warn).not.toHaveBeenCalledWith(expect.stringMatching(/has no entry point/));
  });

  it("stays quiet while the tour is unavailable, since the trigger legitimately renders nothing", async () => {
    stubMatchMedia(false);
    const warn = await mountWith(
      <TutorialProvider config={defineTutorial({ id: "gated", steps, minWidth: 768 })}>
        <Probe /><TourTrigger /><TutorialStage />
      </TutorialProvider>,
    );
    expect(warn).not.toHaveBeenCalledWith(expect.stringMatching(/has no entry point/));
  });
});
