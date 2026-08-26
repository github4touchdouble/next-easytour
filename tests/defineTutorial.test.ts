import { describe, expect, it, vi } from "vitest";
import { defineTutorial, httpStore, validateConfig, type Step } from "../src";

const steps: Step[] = [{ id: "a", title: "A" }];

// ────────────────────────────────────────────────────────────────────────
// Defaults
// ────────────────────────────────────────────────────────────────────────

describe("defineTutorial — defaults", () => {
  it("wraps in-code steps in a read-only store", async () => {
    const config = defineTutorial({ id: "t", steps });
    expect(config.store.readonly).toBe(true);
    expect((await config.store.load!()).steps).toEqual(steps);
  });

  it("prefers an explicit store over in-code steps", () => {
    const store = httpStore("/tour.json");
    expect(defineTutorial({ id: "t", steps, store }).store).toBe(store);
  });

  it("defaults the card to fixed positioning", () => {
    expect(defineTutorial({ id: "t", steps }).card.positioning).toBe("fixed");
  });

  it("keeps an explicit card config while filling the rest", () => {
    const config = defineTutorial({
      id: "t", steps, card: { anchor: { space: "viewport", x: 10, y: 20 } },
    });
    expect(config.card).toEqual({
      positioning: "fixed", anchor: { space: "viewport", x: 10, y: 20 },
    });
  });

  it("turns completion off when set to false", () => {
    expect(defineTutorial({ id: "t", steps, completion: false }).completion).toBe(false);
  });

  it("defaults the editor to panel + handles + reload, and no permission", () => {
    expect(defineTutorial({ id: "t", steps }).editor).toEqual({
      panel: true, handles: true, reloadAfterSave: true,
    });
  });

  it("defaults autoStart to off", () => {
    expect(defineTutorial({ id: "t", steps }).autoStart).toBe(false);
  });

  it("expands autoStart: true into once + no delay", () => {
    expect(defineTutorial({ id: "t", steps, autoStart: true }).autoStart)
      .toEqual({ once: true, delay: 0 });
  });

  it("keeps an explicit autoStart delay", () => {
    expect(defineTutorial({ id: "t", steps, autoStart: { delay: 500 } }).autoStart)
      .toEqual({ once: true, delay: 500 });
  });

  it("defaults enabled to true", () => {
    expect(defineTutorial({ id: "t", steps }).enabled).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────
// Validation
// ────────────────────────────────────────────────────────────────────────

describe("validateConfig", () => {
  it("accepts a well-formed config", () => {
    expect(validateConfig({ id: "t", steps })).toEqual([]);
  });

  it("flags a missing id", () => {
    expect(validateConfig({ id: "", steps }).join(" ")).toMatch(/`id` is required/);
  });

  it("flags a config with neither steps nor store", () => {
    expect(validateConfig({ id: "t" }).join(" ")).toMatch(/nothing to show/);
  });

  it("flags steps and store both being set", () => {
    expect(validateConfig({ id: "t", steps, store: httpStore("/x.json") }).join(" "))
      .toMatch(/`store` wins/);
  });

  it("flags media and minWidth both being set", () => {
    expect(validateConfig({ id: "t", steps, media: "(min-width: 1px)", minWidth: 768 }).join(" "))
      .toMatch(/`media` wins/);
  });

  it("flags editing with no writable store, since Save silently degrades", () => {
    expect(validateConfig({ id: "t", steps, editor: { permission: true } }).join(" "))
      .toMatch(/clipboard/);
  });

  it("warns through the console when a config is built in development", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    defineTutorial({ id: "t" });
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/nothing to show/));
    warn.mockRestore();
  });
});
