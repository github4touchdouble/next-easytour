// next-easytour 0.4.0 — public API surface

// ── Configured API (recommended) ────────────────────────────────────────
// One config object, a provider that owns the state, a stage that draws
// the overlays, and a trigger that already knows about all three.

export { defineTutorial, validateConfig } from "./config/defineTutorial";
export type {
  TutorialConfig, ResolvedTutorialConfig,
  CardConfig, CompletionConfig, EditorConfig, AutoStartConfig, FeaturesConfig,
} from "./config/defineTutorial";

export { TutorialProvider, useTour } from "./core/TutorialProvider";

// ── Host features: what a step can make the app do ──────────────────────
export {
  useTutorialFeature, useTutorialFeatures, useFeatureList,
  useFeatureRegistry, createFeatureRegistry, FeatureRegistryProvider,
} from "./core/features";
export type { FeatureRegistry } from "./core/features";

// ── Appearance ──────────────────────────────────────────────────────────
export { THEME_PRESETS, THEME_CSS_VARS, themeToCssVars, useSlotClass } from "./config/appearance";
export type { ThemePreset } from "./config/appearance";
export type { TutorialProviderProps, TourApi } from "./core/TutorialProvider";

export { TutorialStage } from "./core/TutorialStage";
export type { TutorialStageProps, OverlayToggles } from "./core/TutorialStage";

export { TourTrigger } from "./overlay/TourTrigger";
export type { TourTriggerProps } from "./overlay/TourTrigger";

// ── Editor permissions ──────────────────────────────────────────────────

export {
  useEditorPermission, normalizePermission, resolveAllow, matchesChord,
  isProductionBuild,
} from "./config/permission";
export type {
  EditorPermission, EditorPermissionRule, EditorPermissionState, EditorAllow,
} from "./config/permission";

// ── Step sources ────────────────────────────────────────────────────────

export {
  staticStore, httpStore, localStore, clipboardStore, draftOver,
} from "./data/stores";
export type {
  TutorialStore, TutorialPayload, HttpStoreOptions,
} from "./data/stores";

export { useTutorialSteps } from "./data/useTutorialSteps";
export type { TutorialStepsState } from "./data/useTutorialSteps";

export { normalizeStep, normalizeSteps, normalizeTutorial } from "./data/normalize";
export type { NormalizedTutorial, RawTutorial } from "./data/normalize";

// ── Core (headless, wire it yourself) ───────────────────────────────────

export { Tutorial, useTutorial } from "./core/Tutorial";
export { useTutorialTarget } from "./core/useTutorialTarget";
export { OverlayPortal } from "./core/OverlayPortal";
export { useTutorialDone } from "./core/useTutorialDone";
export type { TutorialDoneState } from "./core/useTutorialDone";
export { useFrameSequence, useEnterAnimation, useArrowDraw } from "./core/animation";

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

export { Labels } from "./overlay/Labels";

export { TriggerButton } from "./overlay/TriggerButton";
export type { TriggerButtonProps, TriggerMode } from "./overlay/TriggerButton";

// ── Editor ──────────────────────────────────────────────────────────────

// `Editor` merges pending edits into the step list and passes them
// through, so a host that wraps its tour in it needs it to work in
// production too. It is small, and stays in the main bundle.
export { Editor, useEditorState } from "./editor/Editor";
export type { EditorProps } from "./editor/Editor";

// The authoring UI is loaded on demand and never in production. These are
// chunk-safe wrappers with the same props — see editor/lazyChrome.
export { EditorHandles, EditorPanel, EditorSeam } from "./editor/lazyChrome";
export type { EditorSeamProps } from "./editor/EditorSeam";

// ── Types ───────────────────────────────────────────────────────────────

export type {
  TargetPoint, ViewportAnchor,
  Arrow as ArrowAnnotation, ArrowStyle, Circle, Annotations,
  Step, StepAction, WaitCondition, HighlightEffect, TransitionConfig,
  TutorialStatus, TutorialApi, TutorialProps, TutorialTheme, TutorialClassNames,
  TriggerConfig, TextLabel,
  TutorialFeature, FeatureParam, FeatureDescriptor,
  TextLabelAnimation, TextLabelFrame,
  CanEdit, EditorState, SaveHandler,
} from "./types";

// ── Constructors ────────────────────────────────────────────────────────

export { targetPoint, viewportAnchor } from "./coords";
