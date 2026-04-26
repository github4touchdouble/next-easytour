// next-easytour 0.3.0 — public API surface

// Core
export { Tutorial, useTutorial } from "./core/Tutorial";
export { useTutorialTarget } from "./core/useTutorialTarget";
export { OverlayPortal } from "./core/OverlayPortal";
export { useTutorialDone } from "./core/useTutorialDone";
export type { TutorialDoneState } from "./core/useTutorialDone";
export { useFrameSequence, useEnterAnimation, useArrowDraw } from "./core/animation";

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

export { TriggerButton } from "./overlay/TriggerButton";
export type { TriggerButtonProps, TriggerMode } from "./overlay/TriggerButton";

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
  TutorialStatus, TutorialApi, TutorialProps, TutorialTheme, TriggerConfig, TextLabel,
  TextLabelAnimation, TextLabelFrame,
  CanEdit, EditorState, SaveHandler,
} from "./types";

// Constructors
export { targetPoint, viewportAnchor } from "./coords";