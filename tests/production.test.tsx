/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  defineTutorial, isProductionBuild, localStore, resolveAllow,
  TutorialProvider, TutorialStage, useTour, type Step,
} from "../src";

const steps: Step[] = [{ id: "a", title: "A", body: "body A" }];

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
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function Probe() {
  const tour = useTour();
  return (
    <>
      <span data-testid="loading">{String(tour.loading)}</span>
      <span data-testid="allowed">{String(tour.editor.allowed)}</span>
      <span data-testid="editing">{String(tour.editor.active)}</span>
      <button data-testid="unlock" onClick={tour.editor.unlock}>unlock</button>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────
// The block is unconditional — no argument reopens it
// ────────────────────────────────────────────────────────────────────────

describe("editor in production", () => {
  it("reports a production build from NODE_ENV", () => {
    expect(isProductionBuild()).toBe(false);
    vi.stubEnv("NODE_ENV", "production");
    expect(isProductionBuild()).toBe(true);
  });

  it("denies `allow: true` outright", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(resolveAllow(true)).toBe(false);
  });

  it("denies `dev-only`, which was already development-scoped", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(resolveAllow("dev-only")).toBe(false);
  });

  it("still allows editing outside production", () => {
    expect(resolveAllow(true)).toBe(true);
    expect(resolveAllow("dev-only")).toBe(true);
  });

  it("ignores a permission config that asks for editing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const config = defineTutorial({
      id: "t", store: localStore("t", { fallback: steps }),
      editor: { permission: { allow: true, requireUnlock: false } },
    });
    render(<TutorialProvider config={config}><Probe /><TutorialStage /></TutorialProvider>);
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    expect(screen.getByTestId("allowed").textContent).toBe("false");
    expect(screen.getByTestId("editing").textContent).toBe("false");
  });

  it("ignores `canEdit` from host auth — the override cannot widen access", async () => {
    // The important case: an app whose own auth says "this user is an
    // admin" must not thereby get a live editor on the deployed site.
    vi.stubEnv("NODE_ENV", "production");
    const config = defineTutorial({
      id: "t", store: localStore("t", { fallback: steps }),
      editor: { permission: { allow: false, requireUnlock: false } },
    });
    render(
      <TutorialProvider config={config} canEdit>
        <Probe /><TutorialStage />
      </TutorialProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    expect(screen.getByTestId("allowed").textContent).toBe("false");
    expect(screen.getByTestId("editing").textContent).toBe("false");
  });

  it("cannot be unlocked by the URL param", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const url = new URL(window.location.href);
    url.searchParams.set("edit", "1");
    window.history.replaceState({}, "", url);

    const config = defineTutorial({
      id: "t", store: localStore("t", { fallback: steps }),
      editor: { permission: { allow: true } },
    });
    render(<TutorialProvider config={config}><Probe /></TutorialProvider>);
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    expect(screen.getByTestId("editing").textContent).toBe("false");
    window.history.replaceState({}, "", window.location.pathname);
  });

  it("cannot be unlocked by calling unlock() directly", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const config = defineTutorial({
      id: "t", store: localStore("t", { fallback: steps }),
      editor: { permission: { allow: true } },
    });
    render(<TutorialProvider config={config}><Probe /></TutorialProvider>);
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

    screen.getByTestId("unlock").click();
    await waitFor(() => expect(screen.getByTestId("editing").textContent).toBe("false"));
  });
});
