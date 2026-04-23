/**
 * next-easytour 0.3.0-alpha.3 — Vite + React example.
 *
 * Minimal demo: CSS-selector targeting, auto-scroll, waitFor,
 * highlight, and the default card variant.
 */

import { useState } from "react";
import {
  Tutorial,
  Card,
  Arrow,
  Spotlight,
  targetPoint,
  type Step,
} from "next-easytour";
import "next-easytour/styles.css";

const steps: Step[] = [
  {
    id: "intro",
    title: "Hello!",
    body: "This is a minimal Vite + React demo.\nAuto-advancing in 2 seconds…",
    autoAdvance: 2000,
  },
  {
    id: "input",
    title: "Type your name",
    body: "Fill in the input to proceed.",
    selector: "#name-input",
    scrollIntoView: true,
    highlight: true,
    annotations: {
      spotlight: true,
      arrow: { to: targetPoint(50, 50) },
    },
    actions: [{ type: "focus" }],
    waitFor: { type: "input", pattern: "\\S+" },
  },
  {
    id: "btn",
    title: "Click to finish",
    body: "Click the submit button.",
    selector: "#submit-btn",
    highlight: { pulse: true, color: "#22c55e" },
    annotations: {
      spotlight: true,
      arrow: { to: targetPoint(50, 50), style: { dashed: true } },
    },
    waitFor: { type: "click" },
  },
  {
    id: "done",
    title: "All done!",
    body: "That's the basics of next-easytour alpha.3.",
  },
];

export default function App() {
  const [stepId, setStepId] = useState<string | null>(null);
  const [name, setName] = useState("");

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "2rem", fontFamily: "system-ui" }}>
      <h1>Vite + next-easytour</h1>

      <button onClick={() => setStepId("intro")}
        style={{ padding: "0.5rem 1rem", borderRadius: 6, background: "#4285F4", color: "#fff", border: "none", cursor: "pointer", marginBottom: "1.5rem" }}>
        Start Tour
      </button>

      <div style={{ marginBottom: "1rem" }}>
        <input id="name-input" value={name} onChange={e => setName(e.target.value)}
          placeholder="Your name" style={{ padding: "0.5rem", borderRadius: 6, border: "1px solid #ccc", width: "100%" }} />
      </div>

      <button id="submit-btn"
        style={{ padding: "0.5rem 1rem", borderRadius: 6, border: "1px solid #ccc", cursor: "pointer" }}>
        Submit
      </button>

      <Tutorial steps={steps} stepId={stepId} onStepChange={setStepId}>
        <Spotlight />
        <Arrow />
        <Card />
      </Tutorial>
    </div>
  );
}