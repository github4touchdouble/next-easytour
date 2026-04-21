/**
 * next-easytour — interactive tutorial overlay for React and Next.js.
 *
 * Public entry point. Everything a consumer of the library needs is
 * re-exported from here; nothing else in `src/` is part of the public API.
 *
 * ## Quick start
 *
 * ```tsx
 * "use client";
 * import { useState } from "react";
 * import { TutorialOverlay, type TutorialStep } from "next-easytour";
 * import "next-easytour/styles.css";   // import once, at the app root
 *
 * const STEPS: TutorialStep[] = [
 *   { title: "Welcome", body: "Let me show you around." },
 *   { title: "Save", body: "Click here.", target: "save-button" },
 * ];
 *
 * export default function Page() {
 *   const [step, setStep] = useState<number | null>(null);
 *   return (
 *     <>
 *       <button onClick={() => setStep(0)}>Start tour</button>
 *       <button data-tutorial-id="save-button">Save</button>
 *       {step !== null && (
 *         <TutorialOverlay
 *           steps={STEPS}
 *           step={step}
 *           onStepChange={setStep}
 *           onClose={() => setStep(null)}
 *         />
 *       )}
 *     </>
 *   );
 * }
 * ```
 *
 * ## Public surface
 *
 * - `TutorialOverlay` — the component.
 * - Types: `TutorialOverlayProps`, `TutorialStep`, `TutorialCircle`,
 *   `ArrowStyle`, `ArrowPoint`, `SaveHandler`, `ImageLike`, `CanEdit`.
 * - Hooks: `useLocalStorageCanEdit` (ready-made `canEdit` source backed
 *   by a `localStorage` key).
 * - Geometry helpers: `DEFAULT_STYLE`, `autoTargetPoint`, `resolvePoint`,
 *   `cardSourcePx`, `pixelToRelative`, `buildPath`. Exposed for custom
 *   arrow rendering and unit tests; a typical consumer does not need them.
 *
 * The stylesheet is a separate entry point: `import "next-easytour/styles.css"`.
 *
 * @see README.md for the full guide.
 * @see LLMS.md for a dense reference aimed at code assistants.
 * @packageDocumentation
 */

export { TutorialOverlay } from "./TutorialOverlay";
export type {
  ArrowPoint,
  ArrowStyle,
  TutorialCircle,
  TutorialStep,
  TutorialOverlayProps,
  SaveHandler,
  ImageLike,
  CanEdit,
} from "./types";
export { useLocalStorageCanEdit } from "./useDebugMode";
export {
  DEFAULT_STYLE,
  autoTargetPoint,
  resolvePoint,
  cardSourcePx,
  pixelToRelative,
  buildPath,
} from "./geometry";