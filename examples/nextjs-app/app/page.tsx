"use client";

/**
 * next-easytour 0.3.0 — Next.js App Router example.
 *
 * Demonstrates CSS-selector targeting, step actions, waitFor,
 * auto-advance, auto-scroll, highlight, and the default card.
 */

import { useState } from "react";
import {
  Tutorial,
  Card,
  Arrow,
  Spotlight,
  Circles,
  TriggerButton,
  useTutorialTarget,
  useTutorialDone,
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
    body: "You saw CSS-selector targeting, step actions, waitFor, auto-advance, highlights, circles, and animated arrows.",
    meta: { note: "final step" },
  },
];

function Counter() {
  const [count, setCount] = useState(0);
  const ref = useTutorialTarget<HTMLButtonElement>("counter-btn");
  return (
    <button ref={ref} onClick={() => setCount(c => c + 1)}
      style={{ padding: "0.5rem 1rem", borderRadius: 6, border: "1px solid #ccc", cursor: "pointer" }}>
      Count: {count}
    </button>
  );
}

export default function Page() {
  const [stepId, setStepId] = useState<string | null>(null);
  const { done, markDone } = useTutorialDone("demo-tutorial");

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "2rem", fontFamily: "system-ui" }}>
      <h1>next-easytour demo</h1>

      <TriggerButton
        onClick={() => setStepId("welcome")}
        text="Start Tour"
        mode="annoying"
        done={done}
      />

      <div style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}>
        <label htmlFor="demo-search" style={{ fontSize: "0.875rem", fontWeight: 500 }}>Search</label>
        <input id="demo-search" type="text" placeholder="Type something…"
          style={{ display: "block", width: "100%", padding: "0.5rem", marginTop: "0.25rem", borderRadius: 6, border: "1px solid #ccc" }} />
      </div>

      <div style={{ marginBottom: "1.5rem" }}><Counter /></div>

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

      <Tutorial<DemoMeta>
        steps={steps} stepId={stepId} onStepChange={setStepId}
        onStepEnter={(s) => {
          if (s.id === "done") markDone();
        }}
      >
        <Spotlight />
        <Arrow />
        <Card />
      </Tutorial>

      <style>{`.demo-ring { outline: 2px solid #4285F4; outline-offset: 4px; border-radius: 8px; }`}</style>
    </main>
  );
}