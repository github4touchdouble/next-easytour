import { useState } from "react";
import { TutorialOverlay, type TutorialStep } from "next-easytour";

// Vite / CRA / Remix do not require "use client" — the directive is
// Next.js App Router specific. The component works identically.

const STEPS: TutorialStep[] = [
  { title: "Welcome", body: "This is the Vite + React example." },
  {
    title: "Save",
    body: "Arrow-highlighted target with a custom caption.",
    target: "save-button",
    targetLabel: "Save",
    arrowTo: { x: 50, y: 50 },
    arrowStyle: { bend: 28 },
  },
  {
    title: "Data",
    body: "The arrow re-targets automatically as the step changes.",
    target: "data-list",
    arrowStyle: { bend: 35, flip: true },
  },
];

export default function App() {
  const [step, setStep] = useState<number | null>(null);

  return (
    <main style={{ maxWidth: 640, margin: "3rem auto", padding: "0 1.5rem", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 24 }}>next-easytour · Vite demo</h1>
      <p style={{ color: "#6b7280" }}>
        Click <strong>Start tour</strong> to walk through the steps.
      </p>

      <button onClick={() => setStep(0)} style={{ padding: "8px 14px", marginTop: 12 }}>
        Start tour
      </button>

      <div style={{ marginTop: 32, display: "flex", gap: 16 }}>
        <button data-tutorial-id="save-button" style={{ padding: "8px 14px" }}>
          Save
        </button>
        <div
          data-tutorial-id="data-list"
          style={{ padding: "12px 16px", border: "1px solid #e5e7eb", borderRadius: 6 }}
        >
          Recent entries…
        </div>
      </div>

      {step !== null && (
        <TutorialOverlay
          steps={STEPS}
          step={step}
          onStepChange={setStep}
          onClose={() => setStep(null)}
        />
      )}
    </main>
  );
}