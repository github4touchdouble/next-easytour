/**
 * next-easytour 0.4.0 — Vite + React example.
 *
 * Minimal demo: one config object, CSS-selector targeting, auto-scroll,
 * waitFor, highlight, and the default card.
 */

import { useState } from "react";
import {
  defineTutorial,
  TourTrigger,
  TutorialProvider,
  TutorialStage,
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
    id: "outro",
    title: "That's it!",
    body: "Three steps, no wiring.",
  },
];

const tour = defineTutorial({
  id: "vite-demo",
  steps,
  trigger: { text: "Start Tour", mode: "annoying" },
});

export default function App() {
  const [name, setName] = useState("");

  return (
    <TutorialProvider config={tour}>
      <main style={{ maxWidth: 560, margin: "0 auto", padding: "2rem", fontFamily: "system-ui" }}>
        <h1>next-easytour — Vite demo</h1>

        <TourTrigger />

        <div style={{ marginTop: "1.5rem" }}>
          <label htmlFor="name-input" style={{ fontSize: "0.875rem", fontWeight: 500 }}>Your name</label>
          <input
            id="name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Type here…"
            style={{ display: "block", width: "100%", padding: "0.5rem", marginTop: "0.25rem", borderRadius: 6, border: "1px solid #ccc" }}
          />
        </div>

        <TutorialStage />
      </main>
    </TutorialProvider>
  );
}
