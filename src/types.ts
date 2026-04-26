/**
 * @module types
 *
 * Public type surface of next-easytour 0.3.0-alpha.3.
 *
 * Alpha.3 adds: CSS-selector targeting, step actions, waitFor
 * conditions, auto-advance, highlight effects, animated transitions,
 * auto-scroll, and JSX body content.
 */

import type * as React from "react";

// ── Coordinate systems ──────────────────────────────────────────────────

export interface TargetPoint {
  space: "target";
  x: number;
  y: number;
}

export interface ViewportAnchor {
  space: "viewport";
  x: number;
  y: number;
}

// ── Arrow + annotations ─────────────────────────────────────────────────

export interface ArrowStyle {
  bend?: number;
  flip?: boolean;
  strokeWidth?: number;
  dashed?: boolean;
  headSize?: number;
  loopEnd?: boolean;
  /** Animate the arrow drawing on step enter. Default true. */
  animated?: boolean;
  /** Draw a straight line instead of a Bézier curve. Default false. */
  straight?: boolean;
}

export interface Arrow {
  to: TargetPoint;
  label?: string;
  style?: ArrowStyle;
}

export interface Circle {
  x: number;
  y: number;
  r: number;
  ry?: number;
  rot?: number;
  label?: string;
}

/** Text annotation placed relative to the target element. */
export interface TextLabel {
  /** The text content (used as initial/static text). */
  text: string;
  /** Position as % of target rect (0–100). */
  position: TargetPoint;
  /** Visual style. Default "callout". */
  variant?: "plain" | "callout" | "badge" | "tag" | "code";
  /** Text colour override. */
  color?: string;
  /** Font size in px. Default 12. */
  fontSize?: number;
  /** Max width in px before wrapping. Default 200. */
  maxWidth?: number;
  /** Animated text sequence — cycles through frames within the step. */
  animation?: TextLabelAnimation;
}

/** Animated text sequence on a label. */
export interface TextLabelAnimation {
  /** Frames to cycle through. Each overrides text and optionally style. */
  frames: TextLabelFrame[];
  /** Duration per frame in ms. Default 2000. */
  frameDuration?: number;
  /** Transition style between frames. Default "fade". */
  transition?: "fade" | "slide-up" | "none";
  /** Loop back to the first frame after the last. Default false. */
  loop?: boolean;
  /** Delay before the first frame starts, in ms. Default 0. */
  delay?: number;
}

/** A single frame in a label animation sequence. */
export interface TextLabelFrame {
  text: string;
  variant?: TextLabel["variant"];
  color?: string;
  fontSize?: number;
}

export interface Annotations {
  arrow?: Arrow;
  circles?: Circle[];
  spotlight?: boolean;
  /** Text labels placed on or near the target. */
  labels?: TextLabel[];
}

// ── Step actions (NEW) ──────────────────────────────────────────────────

export type StepAction =
  | { type: "scroll-into-view"; behavior?: ScrollBehavior; block?: ScrollLogicalPosition; inline?: ScrollLogicalPosition }
  | { type: "click"; selector?: string }
  | { type: "focus"; selector?: string }
  | { type: "highlight"; pulse?: boolean; className?: string; duration?: number }
  | { type: "add-class"; selector?: string; className: string }
  | { type: "remove-class"; selector?: string; className: string }
  | { type: "set-attribute"; selector?: string; name: string; value: string }
  | { type: "dispatch"; event: string; detail?: unknown; selector?: string }
  | { type: "wait"; ms: number };

// ── WaitFor conditions (NEW) ────────────────────────────────────────────

export type WaitCondition =
  | { type: "click"; selector?: string }
  | { type: "input"; selector?: string; pattern?: string }
  | { type: "event"; name: string; selector?: string }
  | { type: "delay"; ms: number }
  | { type: "visible"; selector: string }
  | { type: "custom"; predicate: () => boolean; pollMs?: number };

// ── Highlight effect (NEW) ──────────────────────────────────────────────

export interface HighlightEffect {
  pulse?: boolean;
  color?: string;
  padding?: number;
  borderRadius?: number;
}

// ── Transition / animation config (NEW) ─────────────────────────────────

export interface TransitionConfig {
  enter?: "fade" | "fade-slide" | "scale" | "none";
  exit?: "fade" | "scale" | "none";
  duration?: number;
}

// ── Step ─────────────────────────────────────────────────────────────────

export interface Step<Meta = never> {
  id: string;
  title?: string;
  body?: string;
  /** Body as JSX — takes precedence over `body` string. */
  content?: React.ReactNode;

  /** Target IDs registered via `useTutorialTarget`. */
  targets?: string[];
  /** CSS selector to find target element at runtime. */
  selector?: string;

  annotations?: Annotations;
  cardAnchor?: ViewportAnchor;

  /** Scroll the target into view before rendering. */
  scrollIntoView?: boolean | ScrollIntoViewOptions;
  /** Ordered side-effects on step enter. */
  actions?: StepAction[];
  /** Block Next until condition is met. */
  waitFor?: WaitCondition;
  /** Auto-advance after N ms (fires after waitFor if both set). */
  autoAdvance?: number;
  /** Highlight ring around target. `true` = default pulse. */
  highlight?: boolean | HighlightEffect;
  /** Per-step transition override. */
  transition?: TransitionConfig;
  /** Host-owned metadata. */
  meta?: Meta;
}

// ── Runtime status ──────────────────────────────────────────────────────

export type TutorialStatus =
  | "closed"
  | "running"
  | "transitioning"
  | "blocked"
  | "waiting";

// ── Component props ─────────────────────────────────────────────────────

export interface TutorialProps<Meta = never> {
  steps: Step<Meta>[];
  stepId: string | null;
  onStepChange: (id: string | null) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onStepEnter?: (step: Step<Meta>, index: number) => void;
  onStepLeave?: (step: Step<Meta>, index: number) => void;
  onWaitComplete?: (step: Step<Meta>, index: number) => void;
  canAdvance?: (step: Step<Meta>, index: number) => boolean;
  transition?: TransitionConfig;
  scrollIntoView?: boolean | ScrollIntoViewOptions;

  /** Default card position for all steps. Steps with their own `cardAnchor` override this. */
  defaultCardAnchor?: ViewportAnchor;

  /**
   * How the card is positioned:
   * - `"fixed"` (default): pinned to the viewport (stays on screen during scroll)
   * - `"absolute"`: positioned relative to the page (scrolls with the page)
   *
   * When `"absolute"`, anchor x/y are interpreted as page pixels (px from
   * document top-left) instead of viewport percentages (vw/vh).
   */
  cardPositioning?: "fixed" | "absolute";

  /**
   * Theme overrides. Sets CSS custom properties on `:root` so all
   * portaled overlays pick them up. Alternatively, set `--eto-*`
   * variables directly in your CSS.
   */
  theme?: TutorialTheme;

  children: React.ReactNode;
}

// ── Consumer hook return type ───────────────────────────────────────────

export interface TutorialApi<Meta = never> {
  status: TutorialStatus;
  step: Step<Meta> | null;
  index: number;
  total: number;
  isFirst: boolean;
  isLast: boolean;
  canAdvance: boolean;
  isWaiting: boolean;
  next: () => void;
  prev: () => void;
  goto: (id: string) => void;
  close: () => void;
  getTargetElement: (targetIdOrSelector?: string) => Element | null;
  /** Default card position for all steps. */
  defaultCardAnchor?: ViewportAnchor;
  /** Card positioning mode. */
  cardPositioning: "fixed" | "absolute";
}

// ── Editor types ────────────────────────────────────────────────────────

export type SaveHandler<Meta = never> = (
  steps: Step<Meta>[],
  options?: { triggerConfig?: TriggerConfig },
) => void | Promise<void>;

export type CanEdit =
  | boolean
  | "auto"
  | (() => boolean)
  | { useCanEdit: () => boolean };

export interface EditorState {
  active: boolean;
  unsavedCount: number;
  saveStatus: "idle" | "saving" | "saved" | "error";
  save: () => Promise<void>;
  revert: () => void;
  setCardAnchor?: (stepId: string, a: ViewportAnchor) => void;
  clearCardAnchor?: (stepId: string) => void;
  setArrowTip?: (stepId: string, p: TargetPoint) => void;
  setArrow?: (
    stepId: string,
    spec: {
      targets?: string[];
      to: TargetPoint;
      style?: ArrowStyle;
      label?: string;
    },
  ) => void;
  setCircles?: (stepId: string, c: Circle[]) => void;
}

// (CardVariant and BrandedCardProps removed in alpha.19 — use render-prop for custom card styling)

// ── Theming ─────────────────────────────────────────────────────────────

/**
 * Theme configuration for styling all library components.
 * Each property maps to a CSS custom property (`--eto-*`).
 * Set via the `theme` prop on `<Tutorial>` or directly in CSS:
 *
 * ```css
 * :root {
 *   --eto-accent: #3b82f6;
 *   --eto-surface: #ffffff;
 * }
 * ```
 */
export interface TutorialTheme {
  /** Primary brand colour. Used for buttons, pills, active states. Default "#4285F4". */
  accent?: string;
  /** Card / panel background. Default "#ffffff". */
  surface?: string;
  /** Primary text colour. Default "#18181b". */
  fg?: string;
  /** Secondary text colour. Default "#71717a". */
  muted?: string;
  /** Tertiary text colour. Default "#a1a1aa". */
  mutedSoft?: string;
  /** Border colour. Default derived from accent. */
  border?: string;
  /** Subtle border colour. Default derived from accent. */
  borderSoft?: string;
  /** Hover background. Default "rgba(0,0,0,0.06)". */
  hoverBg?: string;
  /** Arrow stroke colour. Default "#404040". */
  arrowColor?: string;
  /** Arrow stroke opacity. Default "0.35". */
  arrowOpacity?: string;
  /** Card width. Default "min(480px, calc(100vw - 2rem))". */
  cardWidth?: string;
  /** Card border radius. Default "0.5rem". */
  cardRadius?: string;
}

/** Configuration for the tutorial trigger button. */
export interface TriggerConfig {
  /** Button text. Default "Start tutorial". */
  text?: string;
  /** Visual mode. Default "default". */
  mode?: "annoying" | "default";
  /** Show help-circle icon. Default true. */
  icon?: boolean;
}