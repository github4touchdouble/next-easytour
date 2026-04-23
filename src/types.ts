/**
 * @module types
 *
 * Public type surface of next-easytour 0.3.0.
 *
 * Every type an integrator touches is exported from the package root
 * (`import { … } from "next-easytour"`). Nothing else in `src/` is part
 * of the public API.
 *
 * Design notes
 * ─────────────────────────────────────────────────────────────────────
 * 1. **Coordinate systems are nominal.** `TargetPoint` and `ViewportAnchor`
 *    share an `(x, y)` shape but carry a `space` discriminator so the
 *    type checker catches accidental mixing. A target-relative point
 *    (`50, 50` = centre of the target's bounding rect) is meaningless
 *    if interpreted as a viewport fraction and vice versa.
 *
 * 2. **Steps are identified by string, not index.** `Step.id` is
 *    required. Navigation, lifecycle, and storage all reference the id
 *    so steps can be reordered, inserted, or deleted without breaking
 *    deep-links, analytics, or saved authoring positions.
 *
 * 3. **Host metadata goes under `step.meta`.** 0.2.x used an index
 *    signature (`[key: string]: unknown`) on `TutorialStep` which killed
 *    typo detection for library-known fields. Hosts now declare their
 *    own meta shape and get full type-safety within it; the library's
 *    own fields remain closed.
 *
 * 4. **No `onAction(string)`.** Replaced by four lifecycle callbacks
 *    (`onOpen`, `onClose`, `onStepEnter`, `onStepLeave`) that receive
 *    the step object in full. Hosts dispatch on whatever field of
 *    `step.meta` they like, with their own typing.
 */

import type * as React from "react";

// ────────────────────────────────────────────────────────────────────────
// Coordinate systems
// ────────────────────────────────────────────────────────────────────────

/**
 * A point expressed as a percentage of a target element's bounding rect.
 *
 * - `(0, 0)`   — top-left corner of the target.
 * - `(50, 50)` — centre of the target.
 * - `(100, 100)` — bottom-right corner.
 *
 * Values may fall outside 0–100 to place an arrow tip or annotation
 * beyond the target's box. Percentages are re-resolved against the
 * target's current rect on every tick, so points stay put through
 * scrolling, resizing, and different viewport sizes.
 */
export interface TargetPoint {
  space: "target";
  x: number;
  y: number;
}

/**
 * A point expressed as a percentage of the viewport.
 *
 * - `(0, 0)`   — top-left corner of the viewport.
 * - `(50, 100)` — bottom-centre.
 * - `(100, 50)` — right-centre.
 *
 * Used for card placement. Because values are viewport fractions, the
 * card lands at the same *relative* spot across phones, laptops, and
 * ultrawides without any absolute pixel values.
 */
export interface ViewportAnchor {
  space: "viewport";
  x: number;
  y: number;
}

// ────────────────────────────────────────────────────────────────────────
// Arrow + annotations
// ────────────────────────────────────────────────────────────────────────

/**
 * Visual styling for a Bézier arrow. Every field is optional; defaults
 * are applied by the `<Arrow>` component.
 */
export interface ArrowStyle {
  /** Curvature magnitude (5–80). Larger = more pronounced arc. Default 30. */
  bend?: number;
  /** Mirror the arc to the opposite side of the straight line. Default false. */
  flip?: boolean;
  /** Line weight in SVG pixel units. Default 1.5. */
  strokeWidth?: number;
  /** Dashed stroke pattern for the arrow shaft. Default false. */
  dashed?: boolean;
  /** Size of the arrowhead marker. Default 8. */
  headSize?: number;
  /** Replace the pointed arrowhead with a looped eye/circle. Default false. */
  loopEnd?: boolean;
}

/** An arrow pointing from the card to a target point. */
export interface Arrow {
  /** Tip of the arrow, relative to the target. */
  to: TargetPoint;
  /** Optional caption rendered at the arrow tip. */
  label?: string;
  /** Style overrides. */
  style?: ArrowStyle;
}

/**
 * An annotated ellipse drawn over a target. Useful for circling a
 * cluster of points, a sub-region within a widget, or a feature that
 * doesn't warrant its own target registration.
 *
 * All geometric values are percentages of the target's bounding rect.
 */
export interface Circle {
  /** Centre x, percentage of target width. */
  x: number;
  /** Centre y, percentage of target height. */
  y: number;
  /** Horizontal radius, percentage of target width. */
  r: number;
  /** Vertical radius, percentage of target height. Defaults to `r`. */
  ry?: number;
  /** Rotation in degrees. */
  rot?: number;
  /** Optional label rendered just below the ellipse. */
  label?: string;
}

/**
 * Per-step visual annotations drawn on top of the target(s). Every
 * field is optional; include only what each step needs.
 */
export interface Annotations {
  /** One arrow from the card to a target point. */
  arrow?: Arrow;
  /** Zero or more annotated ellipses. */
  circles?: Circle[];
  /** Dim everything outside the target(s). Default false. */
  spotlight?: boolean;
}

// ────────────────────────────────────────────────────────────────────────
// Step
// ────────────────────────────────────────────────────────────────────────

/**
 * One step in a tutorial.
 *
 * `Meta` is a generic for host-owned metadata. Tours that only use the
 * library's own fields can leave it as the default `never`; tours that
 * carry their own data (action tags, filter state, i18n keys, …) should
 * supply a concrete shape so `step.meta` is fully type-checked.
 *
 * @example Host-typed meta
 * ```ts
 * interface MyMeta {
 *   action?: "scroll-to-top" | "open-modal" | "flash";
 *   highlight?: string;
 * }
 * const steps: Step<MyMeta>[] = [
 *   { id: "welcome", title: "Hi", body: "…" },
 *   { id: "save", title: "Save", body: "…", meta: { action: "flash" } },
 * ];
 * ```
 */
export interface Step<Meta = never> {
  /**
   * Stable identifier. Required. Used for navigation
   * (`onStepChange("save")`), deep-linking, lifecycle callbacks, and
   * the authoring editor's per-step overrides. Must be unique within
   * a step list.
   */
  id: string;

  /** Heading displayed by the default `<Card>`. */
  title?: string;

  /** Body copy displayed by the default `<Card>`. */
  body?: string;

  /**
   * IDs of the target elements this step highlights or points at.
   * Register targets with `useTutorialTarget(id)`. Multiple targets
   * are supported — useful for spotlighting a group of elements
   * simultaneously.
   */
  targets?: string[];

  /**
   * Visual annotations drawn for this step. The arrow points at the
   * first target by default; specify a different target id via the
   * arrow's own field if needed (see `Arrow.to` extensions in future
   * releases).
   */
  annotations?: Annotations;

  /**
   * Where the tutorial card sits on screen for this step. Omit for
   * the default placement (bottom-centre, 1.5rem above the viewport
   * bottom). Authored by dragging the card in the editor.
   */
  cardAnchor?: ViewportAnchor;

  /**
   * Host-owned metadata preserved across serialisation round-trips.
   * Shape is declared by the consumer via the `Meta` generic.
   */
  meta?: Meta;
}

// ────────────────────────────────────────────────────────────────────────
// Runtime status exposed via useTutorial()
// ────────────────────────────────────────────────────────────────────────

/**
 * Coarse status of the tutorial state machine, surfaced via
 * `useTutorial()` so hosts can render conditional UI (e.g. a
 * "Restart tour" button only when `status === "closed"`).
 */
export type TutorialStatus =
  /** No active step. The tour is idle. */
  | "closed"
  /** An active step is displayed and interactive. */
  | "running"
  /** Brief fade window between two steps (~80 ms). */
  | "transitioning"
  /** Active step, but `canAdvance` returned `false`. */
  | "blocked";

// ────────────────────────────────────────────────────────────────────────
// Top-level component props
// ────────────────────────────────────────────────────────────────────────

/**
 * Props for `<Tutorial>`. The component is a headless provider — it
 * renders no DOM of its own. UI comes from children (`<Card>`,
 * `<Arrow>`, `<Spotlight>`, etc.) that read state via context.
 */
export interface TutorialProps<Meta = never> {
  /** Ordered list of steps. Every `Step.id` must be unique. */
  steps: Step<Meta>[];

  /**
   * Active step id, or `null` when the tour is closed. Controlled —
   * the host owns this state and responds to `onStepChange`.
   */
  stepId: string | null;

  /** Called when the user (or the library) navigates to a different step. */
  onStepChange: (id: string | null) => void;

  // ── Lifecycle ──────────────────────────────────────────────────────

  /** Called once when the tour transitions from `closed` to `running`. */
  onOpen?: () => void;

  /** Called once when the tour transitions from `running` to `closed`. */
  onClose?: () => void;

  /**
   * Called whenever a new step becomes active (including on `onOpen`).
   * Ideal place to set up step-specific UI state (highlight a row,
   * open a panel, scroll a list, …).
   */
  onStepEnter?: (step: Step<Meta>, index: number) => void;

  /**
   * Called whenever a step is about to be replaced — either by
   * navigating to another step, or by closing the tour. Mirror of
   * `onStepEnter`.
   */
  onStepLeave?: (step: Step<Meta>, index: number) => void;

  // ── Gating ─────────────────────────────────────────────────────────

  /**
   * Predicate run on every render. When it returns `false`, the
   * tutorial enters `"blocked"` status and the default `<Card>`
   * disables its Next button. Typical use: require the user to fill
   * in a form or click a specific element before the tour advances.
   */
  canAdvance?: (step: Step<Meta>, index: number) => boolean;

  // ── Children ───────────────────────────────────────────────────────

  /** Composable UI: `<Card>`, `<Arrow>`, `<Spotlight>`, custom components. */
  children: React.ReactNode;
}

// ────────────────────────────────────────────────────────────────────────
// Consumer hook return type
// ────────────────────────────────────────────────────────────────────────

/**
 * Public shape of the `useTutorial()` hook. Read state, navigate, or
 * close the tour programmatically. Available to any descendant of
 * `<Tutorial>`.
 */
export interface TutorialApi<Meta = never> {
  /** Coarse state of the tutorial machine. */
  status: TutorialStatus;
  /** The active step, or `null` when `status === "closed"`. */
  step: Step<Meta> | null;
  /** Zero-based index of the active step, or `-1` when closed. */
  index: number;
  /** Total number of steps in the tour. */
  total: number;
  /** Is the active step the first? `false` when closed. */
  isFirst: boolean;
  /** Is the active step the last? `false` when closed. */
  isLast: boolean;
  /** Can the tour currently advance? Returns `false` when blocked. */
  canAdvance: boolean;
  /** Advance to the next step, or close if already at the last. */
  next: () => void;
  /** Step backward. No-op at the first step. */
  prev: () => void;
  /** Jump to an arbitrary step by id. */
  goto: (id: string) => void;
  /** Close the tour. Fires `onStepLeave` then `onClose`. */
  close: () => void;
}

// ────────────────────────────────────────────────────────────────────────
// Editor (separately exposed from the editor entry point)
// ────────────────────────────────────────────────────────────────────────

/**
 * Called when the user clicks Save in the authoring editor. Receives
 * the full updated step list. Throwing or rejecting makes the editor
 * surface an error and fall back to copying the JSON to the clipboard.
 */
export type SaveHandler<Meta = never> = (
  steps: Step<Meta>[],
) => void | Promise<void>;

/**
 * Resolves whether the authoring editor should be accessible. See
 * `@easytour` docs for details; summary:
 *
 * - `true` / `false` — explicit on/off.
 * - `"auto"` — on in development, off in production. Default.
 * - `() => boolean` — synchronous predicate.
 * - `{ useCanEdit: () => boolean }` — a React hook (required shape
 *   when the check calls other hooks, e.g. auth context).
 */
export type CanEdit =
  | boolean
  | "auto"
  | (() => boolean)
  | { useCanEdit: () => boolean };

/**
 * Read-only snapshot of editor state, exposed via `useEditorState()`
 * so hosts can render their own "unsaved changes" indicators or save
 * buttons if they prefer.
 *
 * In 0.3.0-alpha.1 this interface also surfaces the override mutators
 * — but only when `active === true`. The mutator methods are `undefined`
 * when the editor is inactive, which keeps the hook usable from read-
 * only callers (status badges, save-button indicators) without a separate
 * type for each case. Gated access pattern:
 *
 *     const editor = useEditorState();
 *     if (editor?.active) {
 *       editor.setArrow(stepId, {
 *         targets: ["foo"],
 *         to: { space: "target", x: 50, y: 50 },
 *       });
 *     }
 *
 * The `setArrow` helper is new in alpha.1 — a one-shot way to seed both
 * the target list and an initial arrow tip on a step that had neither,
 * so authors can create arrows from scratch without needing to pre-
 * populate JSON.
 */
export interface EditorState {
  /** True while the editor is active (authoring allowed). */
  active: boolean;
  /** How many pending per-step overrides are unsaved. */
  unsavedCount: number;
  /** Current save phase for feedback UI. */
  saveStatus: "idle" | "saving" | "saved" | "error";
  /** Programmatic save. Same behaviour as the editor's Save button. */
  save: () => Promise<void>;
  /** Discard all pending overrides without saving. */
  revert: () => void;

  // ── Mutators (defined only when `active === true`) ───────────────────

  /**
   * Override the card's viewport anchor for the given step. Equivalent
   * to dragging the `<CardHandle>` in `<EditorHandles>`. Undefined when
   * the editor is inactive.
   */
  setCardAnchor?: (stepId: string, a: ViewportAnchor) => void;

  /**
   * Clear a card-anchor override, reverting to the step's saved
   * `cardAnchor` (or the default if none was saved). Undefined when
   * inactive.
   */
  clearCardAnchor?: (stepId: string) => void;

  /**
   * Override the arrow tip for the given step. In alpha.1 this also
   * creates the arrow annotation if the step didn't have one — the
   * merge layer handles both cases. Step must have at least one entry
   * in `targets` for the arrow to render; set both together via
   * `setArrow` below if the step has no targets yet.
   */
  setArrowTip?: (stepId: string, p: TargetPoint) => void;

  /**
   * Seed a brand-new arrow on a step that didn't have one. Sets both
   * `targets` (appended if existing — existing entries are preserved)
   * and `annotations.arrow` with the supplied tip point. Use when
   * authoring a step from scratch in the browser rather than pre-
   * populating the JSON.
   *
   * @example
   *   editor.setArrow?.(stepId, {
   *     targets: ["umap-plot"],
   *     to: { space: "target", x: 50, y: 50 },
   *   });
   */
  setArrow?: (
    stepId: string,
    spec: {
      targets?: string[];
      to: TargetPoint;
      style?: ArrowStyle;
      label?: string;
    },
  ) => void;

  /** Override the circle annotations for the given step (full replace). */
  setCircles?: (stepId: string, c: Circle[]) => void;
}

// ────────────────────────────────────────────────────────────────────────
// Built-in card variants (alpha.1)
// ────────────────────────────────────────────────────────────────────────

/**
 * Layout variant for the built-in `<Card>`.
 *
 * - `"default"` renders the no-branding 0.3.0-alpha.0 layout: minimal
 *   title/body/nav, no gradient, no logo. Suitable for examples,
 *   tests, and hosts that wire their own styles from scratch.
 *
 * - `"branded"` renders a gradient-header card with logo slot, progress
 *   dots, and an accent-filled Next button — suitable as-is for most
 *   product tours without a custom render-prop. Accent colour comes
 *   from `--eto-accent`; hosts can override via the `accent` prop.
 */
export type CardVariant = "default" | "branded";

/**
 * Props recognised by `<Card variant="branded">`. Host supplies a logo
 * (asset path or React node), optional localised labels for the nav
 * buttons, and an optional accent override. Everything else comes from
 * the library's CSS tokens.
 *
 * These fields are ignored when `variant === "default"` or when the
 * host supplies a render-prop child.
 */
export interface BrandedCardProps {
  /**
   * Logo rendered in the gradient header. A string is treated as an
   * `<img src>`; a React node is rendered verbatim (use this to supply
   * a Next.js `<Image>` or an inline SVG).
   */
  logo?: string | React.ReactNode;

  /** Alt text for the logo when it's rendered from a string src. */
  logoAlt?: string;

  /**
   * Localised labels for the card's navigation controls. Defaults are
   * English; override for i18n.
   */
  labels?: {
    back?: string;
    next?: string;
    done?: string;
    close?: string;
  };

  /**
   * Optional CSS colour override for the accent gradient. Takes any
   * valid CSS colour; the gradient darkens the supplied colour by 25%
   * on its far end. Defaults to `var(--eto-accent)`.
   */
  accent?: string;

  /**
   * Hide the progress dots row. Useful for 1-step "tip" tours where
   * the dots add visual noise.
   */
  hideProgress?: boolean;
}