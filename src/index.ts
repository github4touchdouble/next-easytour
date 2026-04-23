/**
 * @packageDocumentation
 *
 * next-easytour 0.3.0
 * ────────────────────
 *
 * A headless tutorial library built as composable components. Wrap
 * your UI in `<Tutorial>`, drop in the overlay primitives you want
 * (`<Card>`, `<Arrow>`, `<Spotlight>`, `<Circles>`), and register
 * target elements through `useTutorialTarget`.
 *
 * Everything exported from here is public, stable surface; anything
 * else in `src/` is internal and may change without notice.
 *
 * @example Minimal tour
 *
 * ```tsx
 * "use client";
 * import { useState } from "react";
 * import {
 *   Tutorial,
 *   Card,
 *   Arrow,
 *   Spotlight,
 *   useTutorialTarget,
 *   type Step,
 * } from "next-easytour";
 * import "next-easytour/styles.css";
 *
 * const steps: Step[] = [
 *   { id: "welcome", title: "Hi", body: "Let me show you around." },
 *   {
 *     id: "save",
 *     title: "Save",
 *     body: "Your work goes here.",
 *     targets: ["save-button"],
 *     annotations: {
 *       spotlight: true,
 *       arrow: { to: { space: "target", x: 50, y: 50 } },
 *     },
 *   },
 * ];
 *
 * function SaveButton() {
 *   const ref = useTutorialTarget("save-button");
 *   return <button ref={ref}>Save</button>;
 * }
 *
 * export default function Page() {
 *   const [stepId, setStepId] = useState<string | null>(null);
 *   return (
 *     <>
 *       <button onClick={() => setStepId("welcome")}>Start tour</button>
 *       <SaveButton />
 *       <Tutorial
 *         steps={steps}
 *         stepId={stepId}
 *         onStepChange={setStepId}
 *       >
 *         <Spotlight />
 *         <Arrow />
 *         <Card />
 *       </Tutorial>
 *     </>
 *   );
 * }
 * ```
 *
 * @example Branded card + authoring editor
 *
 * ```tsx
 * import { Editor, EditorHandles, useEditorState } from "next-easytour";
 *
 * <Editor
 *   steps={steps}
 *   canEdit={isAdmin}
 *   onSave={async (s) => { await fetch("/api/tutorial", { method: "POST", body: JSON.stringify(s) }); }}
 * >
 *   {({ steps }) => (
 *     <Tutorial steps={steps} stepId={stepId} onStepChange={setStepId}>
 *       <Spotlight />
 *       <Arrow />
 *       <Card>{(args) => <MyBrandedCard {...args} />}</Card>
 *       <EditorHandles />
 *     </Tutorial>
 *   )}
 * </Editor>
 * ```
 */

// ────────────────────────────────────────────────────────────────────────
// Core
// ────────────────────────────────────────────────────────────────────────

export { Tutorial, useTutorial } from "./core/Tutorial";
export { useTutorialTarget } from "./core/useTutorialTarget";

// ────────────────────────────────────────────────────────────────────────
// Overlay
// ────────────────────────────────────────────────────────────────────────

export { Card } from "./overlay/Card";
export type { CardProps, CardRenderArgs } from "./overlay/Card";

export { Arrow, useCardRect } from "./overlay/Arrow";
export type { ArrowProps } from "./overlay/Arrow";

export { Spotlight } from "./overlay/Spotlight";
export type { SpotlightProps } from "./overlay/Spotlight";

export { Circles } from "./overlay/Circles";
export type { CirclesProps } from "./overlay/Circles";

// ────────────────────────────────────────────────────────────────────────
// Editor
// ────────────────────────────────────────────────────────────────────────

export { Editor, useEditorState } from "./editor/Editor";
export type { EditorProps } from "./editor/Editor";
export { EditorHandles } from "./editor/EditorHandles";

// ────────────────────────────────────────────────────────────────────────
// Types — the full public type surface
// ────────────────────────────────────────────────────────────────────────

export type {
  // Coordinate systems
  TargetPoint,
  ViewportAnchor,
  // Annotations
  Arrow as ArrowAnnotation,
  ArrowStyle,
  Circle,
  Annotations,
  // Step
  Step,
  // Runtime
  TutorialStatus,
  TutorialApi,
  TutorialProps,
  // Editor
  CanEdit,
  EditorState,
  SaveHandler,
  // Card variants (0.3.0-alpha.1)
  CardVariant,
  BrandedCardProps,
} from "./types";

// ────────────────────────────────────────────────────────────────────────
// Constructors & helpers for coord spaces — exported so consumers can
// build step JSON in TypeScript without memorising the discriminator
// fields. Optional — plain object literals work too.
// ────────────────────────────────────────────────────────────────────────

export { targetPoint, viewportAnchor } from "./coords";