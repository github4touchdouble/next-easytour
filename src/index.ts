/**
 * @packageDocumentation
 *
 * next-easytour 0.3.0-alpha.3
 * ────────────────────────────
 *
 * A generalizable interactive tutorial overlay library for React and
 * Next.js. Compose `<Tutorial>` + `<Card>` + `<Arrow>` + `<Spotlight>`
 * + `<Tooltip>` primitives. Target elements via CSS selectors OR hooks.
 * Declare step actions, wait conditions, highlights, and animations
 * directly in JSON — no custom host code needed for common patterns.
 *
 * @example Minimal tour (CSS selector targeting — no code changes needed)
 *
 * ```tsx
 * "use client";
 * import { useState } from "react";
 * import {
 *   Tutorial, Card, Arrow, Spotlight,
 *   type Step,
 * } from "next-easytour";
 * import "next-easytour/styles.css";
 *
 * const steps: Step[] = [
 *   {
 *     id: "welcome",
 *     title: "Welcome!",
 *     body: "Let me show you around.",
 *     autoAdvance: 3000,
 *   },
 *   {
 *     id: "save",
 *     title: "Save your work",
 *     body: "Click this button to persist changes.",
 *     selector: "#save-button",
 *     scrollIntoView: true,
 *     highlight: true,
 *     annotations: {
 *       spotlight: true,
 *       arrow: { to: { space: "target", x: 50, y: 50 } },
 *     },
 *     waitFor: { type: "click", selector: "#save-button" },
 *   },
 *   {
 *     id: "done",
 *     title: "All set!",
 *     body: "You're ready to go.",
 *     autoAdvance: 2000,
 *   },
 * ];
 *
 * export default function Page() {
 *   const [stepId, setStepId] = useState<string | null>(null);
 *   return (
 *     <>
 *       <button onClick={() => setStepId("welcome")}>Start tour</button>
 *       <button id="save-button">Save</button>
 *       <Tutorial steps={steps} stepId={stepId} onStepChange={setStepId}>
 *         <Spotlight />
 *         <Arrow />
 *         <Card variant="branded" logo="/logo.svg" />
 *       </Tutorial>
 *     </>
 *   );
 * }
 * ```
 *
 * @example Hook-based targeting (for dynamic components)
 *
 * ```tsx
 * import { useTutorialTarget } from "next-easytour";
 *
 * function DynamicRow({ id }: { id: string }) {
 *   const ref = useTutorialTarget(`row-${id}`);
 *   return <div ref={ref}>...</div>;
 * }
 * ```
 *
 * @example Step actions
 *
 * ```tsx
 * const steps: Step[] = [
 *   {
 *     id: "scroll-demo",
 *     title: "Check this out",
 *     selector: ".sidebar-panel",
 *     actions: [
 *       { type: "scroll-into-view", behavior: "smooth" },
 *       { type: "wait", ms: 500 },
 *       { type: "highlight", pulse: true },
 *       { type: "add-class", className: "ring-2 ring-blue-500" },
 *     ],
 *   },
 * ];
 * ```
 */

// ── Core ────────────────────────────────────────────────────────────────

export { Tutorial, useTutorial } from "./core/Tutorial";
export { useTutorialTarget } from "./core/useTutorialTarget";

// ── Overlay ─────────────────────────────────────────────────────────────

export { Card } from "./overlay/Card";
export type { CardProps, CardRenderArgs } from "./overlay/Card";

export { Arrow, useCardRect } from "./overlay/Arrow";
export type { ArrowProps } from "./overlay/Arrow";

export { Spotlight } from "./overlay/Spotlight";
export type { SpotlightProps } from "./overlay/Spotlight";

export { Circles } from "./overlay/Circles";
export type { CirclesProps } from "./overlay/Circles";

export { Tooltip } from "./overlay/Tooltip";
export type { TooltipProps } from "./overlay/Tooltip";

// ── Editor ──────────────────────────────────────────────────────────────

export { Editor, useEditorState } from "./editor/Editor";
export type { EditorProps } from "./editor/Editor";
export { EditorHandles } from "./editor/EditorHandles";

// ── Types ───────────────────────────────────────────────────────────────

export type {
  TargetPoint,
  ViewportAnchor,
  Arrow as ArrowAnnotation,
  ArrowStyle,
  Circle,
  Annotations,
  Step,
  StepAction,
  WaitCondition,
  HighlightEffect,
  TransitionConfig,
  TutorialStatus,
  TutorialApi,
  TutorialProps,
  CanEdit,
  EditorState,
  SaveHandler,
  CardVariant,
  BrandedCardProps,
} from "./types";

// ── Constructors ────────────────────────────────────────────────────────

export { targetPoint, viewportAnchor } from "./coords";