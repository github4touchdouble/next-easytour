"use client";

import { useState } from "react";
import { TutorialOverlay, type TutorialStep } from "next-easytour";

const INITIAL_STEPS: TutorialStep[] = [
  {
    title: "Welcome",
    body: "This is a minimal example of next-easytour. Use the navigation below to step through the tour.",
  },
  {
    title: "Save your work",
    body: "This button would persist your changes in a real app. Notice the arrow and the pulsing highlight.",
    target: "save-button",
    targetLabel: "Save",
    arrowTo: { x: 50, y: 50 },
    arrowStyle: { bend: 28 },
  },
  {
    title: "Browse entries",
    body: "Your data appears here. The arrow re-targets automatically as you navigate between steps.",
    target: "data-list",
    arrowStyle: { bend: 35, flip: true },
  },
  {
    title: "Circle annotations",
    body: "You can circle specific regions inside a target without tagging them individually.",
    target: "data-list",
    circles: [
      { x: 15, y: 30, r: 8, ry: 14, rot: -8, label: "First row" },
      { x: 70, y: 70, r: 10, ry: 10, rot: 0, label: "Bottom right" },
    ],
  },
];

export default function Home() {
  const [steps, setSteps] = useState<TutorialStep[]>(INITIAL_STEPS);
  const [step, setStep] = useState<number | null>(null);
  const [debug, setDebug] = useState(false);

  return (
    <main style={{ maxWidth: 720, margin: "3rem auto", padding: "0 1.5rem" }}>
      <h1 style={{ fontSize: 24, margin: 0 }}>next-easytour demo</h1>
      <p style={{ color: "#6b7280", marginTop: 8 }}>
        Click <strong>Start tour</strong> to walk through the steps. Toggle
        <strong> Author mode</strong> to drag the arrow tip and save your edits
        back to <code>public/tutorial.json</code> (if your dev server has the
        API route from the README).
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button
          onClick={() => setStep(0)}
          style={{
            padding: "8px 14px",
            borderRadius: 6,
            border: "1px solid #4285F4",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          Start tour
        </button>
        <button
          onClick={() => setDebug((d) => !d)}
          style={{
            padding: "8px 14px",
            borderRadius: 6,
            border: "1px solid #9ca3af",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          Author mode: {debug ? "on" : "off"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 40 }}>
        <button
          data-tutorial-id="save-button"
          style={{
            padding: "10px 18px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            background: "#f9fafb",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Save
        </button>
      </div>

      <div
        data-tutorial-id="data-list"
        style={{
          marginTop: 28,
          padding: 16,
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          background: "#fafafa",
          minHeight: 180,
        }}
      >
        <div style={{ padding: "8px 0", borderBottom: "1px solid #e5e7eb" }}>Row 1</div>
        <div style={{ padding: "8px 0", borderBottom: "1px solid #e5e7eb" }}>Row 2</div>
        <div style={{ padding: "8px 0", borderBottom: "1px solid #e5e7eb" }}>Row 3</div>
        <div style={{ padding: "8px 0" }}>Row 4</div>
      </div>

      {step !== null && (
        <TutorialOverlay
          steps={steps}
          step={step}
          onStepChange={setStep}
          onClose={() => setStep(null)}
          debug={debug}
          onSave={async (updated) => {
            // Replace this with a POST to your own backend if you want the
            // changes to survive a reload. For this demo we just keep them
            // in state so you can walk through the updated tour immediately.
            setSteps(updated);
          }}
        />
      )}
    </main>
  );
}
