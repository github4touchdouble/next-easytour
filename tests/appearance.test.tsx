/**
 * @vitest-environment jsdom
 */
import { render, screen, act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  defineTutorial, THEME_PRESETS, THEME_CSS_VARS, themeToCssVars,
  TutorialProvider, TutorialStage, useTour, type Step, type TutorialTheme,
} from "../src";

function stubMatchMedia() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: true, media: query,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {},
    onchange: null, dispatchEvent: () => false,
  }));
}

beforeEach(stubMatchMedia);
afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("style");
});

const steps: Step[] = [{ id: "a", title: "A", body: "body A" }];

function Probe() {
  const tour = useTour();
  return (
    <>
      <span data-testid="loading">{String(tour.loading)}</span>
      <button data-testid="start" onClick={() => tour.start()}>start</button>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Tokens
// ────────────────────────────────────────────────────────────────────────

describe("themeToCssVars", () => {
  it("maps tokens onto their CSS custom properties", () => {
    expect(themeToCssVars({ accent: "#f00", cardRadius: "1rem" })).toEqual({
      "--eto-accent": "#f00",
      "--eto-card-radius": "1rem",
    });
  });

  it("omits tokens that were not set, rather than emitting empty values", () => {
    expect(themeToCssVars({ accent: "#f00" })).toEqual({ "--eto-accent": "#f00" });
  });

  it("returns nothing for an absent theme", () => {
    expect(themeToCssVars(undefined)).toEqual({});
  });

  it("stringifies non-string token values", () => {
    expect(themeToCssVars({ spotlightPadding: 12 as unknown as string }))
      .toEqual({ "--eto-spotlight-padding": "12" });
  });

  it("covers every declared token — a new one without a variable is dead", () => {
    // A token that maps to no CSS variable silently does nothing, which
    // is the kind of gap only a test notices.
    for (const [key, cssVar] of Object.entries(THEME_CSS_VARS)) {
      if (key === "preset") continue;
      expect(cssVar, `token "${key}" has no CSS variable`).toMatch(/^--eto-/);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────
// Presets
// ────────────────────────────────────────────────────────────────────────

describe("presets", () => {
  it("expands a preset into tokens", () => {
    const vars = themeToCssVars({ preset: "soft" });
    expect(vars["--eto-card-radius"]).toBe("1rem");
    expect(vars["--eto-btn-radius"]).toBe("999px");
  });

  it("lets explicit tokens override the preset they build on", () => {
    const vars = themeToCssVars({ preset: "soft", cardRadius: "0px" });
    expect(vars["--eto-card-radius"]).toBe("0px");
    // Untouched preset values survive.
    expect(vars["--eto-btn-radius"]).toBe("999px");
  });

  it("treats `default` as no tokens at all", () => {
    expect(themeToCssVars({ preset: "default" })).toEqual({});
  });

  it("only ever sets known tokens", () => {
    // Presets are token bundles, not stylesheets: a preset cannot do
    // anything a host could not do with `theme` by hand.
    const known = new Set(Object.keys(THEME_CSS_VARS));
    for (const [name, preset] of Object.entries(THEME_PRESETS)) {
      for (const key of Object.keys(preset)) {
        expect(known.has(key), `preset "${name}" sets unknown token "${key}"`).toBe(true);
      }
    }
  });
});

// ────────────────────────────────────────────────────────────────────────
// Applied to the document
// ────────────────────────────────────────────────────────────────────────

describe("theme application", () => {
  async function open(theme: TutorialTheme) {
    render(
      <TutorialProvider config={defineTutorial({ id: "t", steps, theme })}>
        <Probe /><TutorialStage />
      </TutorialProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    await act(async () => { screen.getByTestId("start").click(); });
  }

  it("writes the tokens onto the document root", async () => {
    await open({ accent: "#7c3aed", fontFamily: "Inter, sans-serif" });
    const root = document.documentElement.style;
    await waitFor(() => expect(root.getPropertyValue("--eto-accent")).toBe("#7c3aed"));
    expect(root.getPropertyValue("--eto-font")).toBe("Inter, sans-serif");
  });

  it("applies a preset through the same path", async () => {
    await open({ preset: "glass" });
    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue("--eto-card-backdrop"))
        .toMatch(/blur/),
    );
  });

  it("removes only its own variables when the tour closes", async () => {
    // A host's own :root styling must survive a tour opening and closing.
    document.documentElement.style.setProperty("--eto-accent", "#hosts-own");
    document.documentElement.style.setProperty("--app-colour", "#keep-me");

    const { unmount } = render(
      <TutorialProvider config={defineTutorial({ id: "t", steps, theme: { surface: "#abc" } })}>
        <Probe /><TutorialStage />
      </TutorialProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    await act(async () => { screen.getByTestId("start").click(); });
    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue("--eto-surface")).toBe("#abc"),
    );

    unmount();
    expect(document.documentElement.style.getPropertyValue("--eto-surface")).toBe("");
    expect(document.documentElement.style.getPropertyValue("--app-colour")).toBe("#keep-me");
  });
});

// ────────────────────────────────────────────────────────────────────────
// Slot classes
// ────────────────────────────────────────────────────────────────────────

describe("classNames slots", () => {
  async function openWith(classNames: Record<string, string>) {
    render(
      <TutorialProvider config={defineTutorial({ id: "t", steps, classNames })}>
        <Probe /><TutorialStage />
      </TutorialProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    await act(async () => { screen.getByTestId("start").click(); });
  }

  it("adds host classes to the card without removing the library's own", async () => {
    await openWith({ card: "rounded-xl shadow-2xl" });
    const card = document.querySelector(".eto-card") as HTMLElement;
    expect(card).not.toBeNull();
    expect(card.className).toContain("eto-card");
    expect(card.className).toContain("rounded-xl");
    expect(card.className).toContain("shadow-2xl");
  });

  it("puts the library class first, so host CSS can win on specificity ties", async () => {
    await openWith({ title: "text-2xl" });
    const title = document.querySelector(".eto-title") as HTMLElement;
    expect(title.className.indexOf("eto-title")).toBeLessThan(
      title.className.indexOf("text-2xl"),
    );
  });

  it("reaches the individual parts of the default card", async () => {
    await openWith({
      header: "h-slot", progress: "p-slot", closeButton: "x-slot",
      body: "b-slot", title: "t-slot", copy: "c-slot",
      footer: "f-slot", prevButton: "prev-slot", nextButton: "next-slot",
    });
    for (const slot of [
      "h-slot", "p-slot", "x-slot", "b-slot", "t-slot", "c-slot",
      "f-slot", "prev-slot", "next-slot",
    ]) {
      expect(document.querySelector(`.${slot}`), `slot ${slot} not applied`).not.toBeNull();
    }
  });

  it("leaves the markup untouched when no classNames are given", async () => {
    await openWith({});
    const card = document.querySelector(".eto-card") as HTMLElement;
    expect(card.className.trim()).toMatch(/^eto-card/);
  });
});
