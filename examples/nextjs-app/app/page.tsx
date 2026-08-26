"use client";

/**
 * next-easytour 0.4.0 — Next.js App Router example.
 *
 * Shows the configured API: one `defineTutorial` object, a provider that
 * owns the state, and a stage that draws the tour. Also demonstrates
 * CSS-selector targeting, step actions, waitFor, auto-advance,
 * auto-scroll, highlight, circles, and the dev-only editor.
 */

import { useState } from "react";
import {
  defineTutorial,
  draftOver,
  localStore,
  staticStore,
  TourTrigger,
  TutorialProvider,
  TutorialStage,
  useTutorialFeature,
  useTutorialTarget,
  targetPoint,
  viewportAnchor,
  type Step,
} from "next-easytour";

interface DemoMeta { note?: string }

const steps: Step<DemoMeta>[] = [
  {
    id: "welcome",
    title: "Welcome to the Demo",
    body: "This tour shows off next-easytour.\nIt will auto-advance in 3 seconds…",
    autoAdvance: 3000,
  },
  {
    id: "search",
    title: "Try searching",
    body: "Type something in the search box to continue.",
    selector: "#demo-search",
    scrollIntoView: true,
    highlight: true,
    annotations: {
      spotlight: true,
      arrow: { to: targetPoint(50, 50) },
    },
    actions: [{ type: "focus", selector: "#demo-search" }],
    waitFor: { type: "input", selector: "#demo-search", pattern: "\\S+" },
  },
  {
    id: "counter",
    title: "The Counter",
    body: "This uses hook-based targeting.\nClick the button to continue.",
    targets: ["counter-btn"],
    highlight: { pulse: true, color: "#22c55e" },
    annotations: {
      spotlight: true,
      arrow: { to: targetPoint(50, 90), style: { dashed: true } },
    },
    waitFor: { type: "click" },
  },
  {
    id: "feature-drive",
    title: "The tour can drive the app",
    body: "This step called a feature the Counter registered, and set it to 42 directly.",
    targets: ["counter-btn"],
    highlight: true,
    actions: [{ type: "feature", name: "counter.set", args: [42] }],
  },
  {
    id: "feature-wait",
    title: "…and wait for you",
    body: "Open the details panel to continue. The step is blocked on a feature's value, not on a DOM event.",
    selector: "#details-panel",
    highlight: true,
    annotations: { spotlight: true },
    waitFor: { type: "feature", name: "details.open" },
  },
  {
    id: "features",
    title: "Feature List",
    body: "The library scrolled this into view and highlighted it.",
    selector: "#feature-list",
    scrollIntoView: { behavior: "smooth", block: "center" },
    highlight: true,
    annotations: {
      arrow: { to: targetPoint(10, 50), style: { loopEnd: true } },
    },
    actions: [
      { type: "scroll-into-view", behavior: "smooth" },
      { type: "wait", ms: 500 },
      { type: "add-class", selector: "#feature-list", className: "demo-ring" },
    ],
  },
  {
    id: "chart",
    title: "Annotated Regions",
    body: "Circles highlight sub-regions within a target.",
    selector: "#demo-chart",
    annotations: {
      circles: [
        { x: 30, y: 40, r: 15, label: "Region A" },
        { x: 70, y: 60, r: 20, ry: 12, rot: -15, label: "Region B" },
      ],
    },
    cardAnchor: viewportAnchor(70, 20),
  },
  {
    id: "done",
    title: "Tour Complete!",
    body: "You saw selector targeting, step actions, waitFor, auto-advance, highlights, circles, animated arrows — and a tour driving the app through registered features.",
    meta: { note: "final step" },
  },
];

/**
 * The whole tour, in one object.
 *
 * The store reads the steps above until you edit the tour, then prefers
 * your local draft — so the demo's editor works with no backend. A real
 * app would use `httpStore("/tour.json", { saveTo: "/api/tutorial" })`
 * and the route handler in `app/api/tutorial/route.ts`.
 */
const tour = defineTutorial<DemoMeta>({
  id: "demo-tutorial",
  store: draftOver(staticStore(steps), localStore("demo-tutorial-draft")),
  trigger: { text: "Start Tour", mode: "annoying" },
  // The whole look, in one place. `preset` is a bundle of tokens; the
  // tokens beside it are applied on top. Try "minimal", "glass",
  // "contrast" — or drop `preset` and set tokens alone.
  theme: {
    preset: "soft",
    accent: "#4f46e5",
    fontFamily: "system-ui, sans-serif",
  },
  // Allowed outside production, but still hidden behind an unlock:
  // open ?edit=1, or press Ctrl/Cmd+Shift+E.
  editor: { permission: "dev-only" },
});

function Counter() {
  const [count, setCount] = useState(0);
  const ref = useTutorialTarget<HTMLButtonElement>("counter-btn");

  /**
   * Expose this component's behaviour to tours, by name.
   *
   * A step can now say `{"type":"feature","name":"counter.set","args":[7]}`
   * and the counter jumps to 7 — no synthesised clicks, no DOM poking, and
   * nothing about the tour leaking into this component beyond these lines.
   * `snapshot`/`restore` mean the count goes back to whatever the visitor
   * had when the tour ends.
   */
  useTutorialFeature({
    name: "counter.set",
    label: "Set the counter",
    description: "Jump the counter straight to a value.",
    params: [{ name: "value", type: "number", required: true }],
    run: (value: number) => setCount(value),
    read: () => count,
    snapshot: () => count,
    restore: (n) => setCount(n as number),
  });

  return (
    <button ref={ref} onClick={() => setCount(c => c + 1)}
      style={{ padding: "0.5rem 1rem", borderRadius: 6, border: "1px solid #ccc", cursor: "pointer" }}>
      Count: {count}
    </button>
  );
}

/**
 * A panel the tour can open and close.
 *
 * `run` returns a cleanup, so the panel closes again when the step is
 * left — the tour borrows the UI rather than rearranging it permanently.
 */
function DetailsPanel() {
  const [open, setOpen] = useState(false);

  useTutorialFeature({
    name: "details.open",
    label: "Open the details panel",
    description: "Expands the panel, and closes it again when the step ends.",
    run: () => {
      setOpen(true);
      return () => setOpen(false);
    },
    read: () => open,
  });

  return (
    <div id="details-panel" style={{ marginBottom: "1.5rem" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ padding: "0.35rem 0.75rem", borderRadius: 6, border: "1px solid #ccc", cursor: "pointer", fontSize: "0.8125rem" }}>
        {open ? "Hide" : "Show"} details
      </button>
      {open && (
        <p style={{ marginTop: "0.5rem", padding: "0.75rem", background: "#f3f4f6", borderRadius: 6, fontSize: "0.8125rem" }}>
          The tour opened this panel by calling a feature — not by clicking the button.
        </p>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <TutorialProvider config={tour}>
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "2rem", fontFamily: "system-ui" }}>
        <h1>next-easytour demo</h1>

        {/* Knows its own label, completion state, and when to hide. */}
        <TourTrigger />

        <div style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}>
          <label htmlFor="demo-search" style={{ fontSize: "0.875rem", fontWeight: 500 }}>Search</label>
          <input id="demo-search" type="text" placeholder="Type something…"
            style={{ display: "block", width: "100%", padding: "0.5rem", marginTop: "0.25rem", borderRadius: 6, border: "1px solid #ccc" }} />
        </div>

        <div style={{ marginBottom: "1.5rem" }}><Counter /></div>

        <DetailsPanel />

        <ul id="feature-list" style={{ marginBottom: "1.5rem", lineHeight: 1.8 }}>
          <li>CSS-selector targeting</li>
          <li>Step actions (scroll, highlight, class, dispatch)</li>
          <li>WaitFor conditions (click, input, event, delay)</li>
          <li>Auto-advance &amp; auto-scroll</li>
          <li>Highlight ring with pulse</li>
          <li>Animated arrow draw-on</li>
        </ul>

        <div id="demo-chart" style={{ width: "100%", height: 200, background: "#f3f4f6", borderRadius: 8, border: "1px solid #e5e7eb", marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
          Chart placeholder
        </div>

        {/* Overlays, plus the editor chrome when unlocked. No props needed. */}
        <TutorialStage<DemoMeta> />

        <style>{`.demo-ring { outline: 2px solid #4285F4; outline-offset: 4px; border-radius: 8px; }`}</style>
      </main>
    </TutorialProvider>
  );
}
