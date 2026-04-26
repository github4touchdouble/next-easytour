// next-easytour 0.3.0-alpha.6 — public API surface

// Core
export { Tutorial, useTutorial } from "./core/Tutorial";
export { useTutorialTarget } from "./core/useTutorialTarget";
export { OverlayPortal } from "./core/OverlayPortal";

// Overlay
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

export { Labels } from "./overlay/Labels";

// Editor
export { Editor, useEditorState } from "./editor/Editor";
export type { EditorProps } from "./editor/Editor";
export { EditorHandles } from "./editor/EditorHandles";
export { EditorPanel } from "./editor/EditorPanel";

// Types
export type {
  TargetPoint, ViewportAnchor,
  Arrow as ArrowAnnotation, ArrowStyle, Circle, Annotations,
  Step, StepAction, WaitCondition, HighlightEffect, TransitionConfig,
  TutorialStatus, TutorialApi, TutorialProps, TextLabel,
  TextLabelAnimation, TextLabelFrame,
  CanEdit, EditorState, SaveHandler, CardVariant, BrandedCardProps,
} from "./types";

// Constructors
export { targetPoint, viewportAnchor } from "./coords";