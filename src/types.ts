import type * as React from "react";

/**
 * Relative point on the target element, expressed in percentages.
 * (0,0)   = top-left corner of the target.
 * (50,50) = dead centre.
 * (100,100) = bottom-right corner.
 *
 * Values may fall outside 0–100 to place an arrow tip or circle beyond
 * the target's bounding box (useful for pointing at overflowed content).
 * Percentages survive scroll, resize, and different viewport sizes because
 * they are re-resolved on every tick against the element's current rect.
 */
export interface ArrowPoint {
  x: number;
  y: number;
}

/**
 * Visual styling for the Bézier arrow connecting the tutorial card to its
 * target point. Every field is optional; defaults are applied internally.
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
  /** Replace the pointed arrowhead with a small looped eye/circle. Default false. */
  loopEnd?: boolean;
}

/**
 * An annotated ellipse drawn around a region of the target element, with an
 * optional faint line connecting the tutorial card to the shape. Useful for
 * circling a cluster of points, a button, or a feature within the target
 * without requiring its own data-tutorial-id attribute.
 */
export interface TutorialCircle {
  /** Centre x, percentage of target width. */
  x: number;
  /** Centre y, percentage of target height. */
  y: number;
  /** Horizontal radius, percentage of target width. */
  r: number;
  /** Vertical radius, percentage of target height. Defaults to `r` (circle). */
  ry?: number;
  /** Rotation in degrees. */
  rot?: number;
  /** Optional label rendered just below the ellipse. */
  label?: string;
}

/**
 * One step in the tour. Unrecognised fields are preserved verbatim via the
 * index signature, so host applications may attach arbitrary metadata
 * and consume it from their own `onAction` or step-change callbacks.
 */
export interface TutorialStep {
  /** Heading displayed in the card. */
  title: string;
  /** Body copy displayed below the heading. */
  body: string;
  /**
   * The `data-tutorial-id` of the element this step highlights and points
   * to. Omit for a card-only step with no arrow or highlight.
   */
  target?: string;
  /** Small caption rendered at the arrow tip. */
  targetLabel?: string;
  /** Arrow tip position, relative to the target element. Defaults to centre. */
  arrowTo?: ArrowPoint;
  /** Per-step overrides of the default arrow style. */
  arrowStyle?: ArrowStyle;
  /** Zero or more annotated ellipses to draw on top of the target. */
  circles?: TutorialCircle[];
  /**
   * Where the tutorial card sits on screen for this step. Expressed as
   * viewport percentages (0–100) of both axes, pointing at the card's
   * top-left corner after any margin. Omit for the default placement
   * (bottom-centre, 1.5 rem above the viewport bottom).
   *
   * Because the anchor is a *viewport fraction*, the card lands in the
   * same relative spot on a phone, a laptop, or an ultrawide — no
   * absolute pixels are hard-coded.
   *
   * When the authoring editor is active the card grows a drag handle
   * in its header. Dragging writes to this field on Save.
   */
  cardAnchor?: { x: number; y: number };
  /**
   * Free-form string surfaced through `onAction` when this step activates,
   * so the host can drive custom effects (scrolling, filtering, triggering
   * animations). The library does not interpret the value itself.
   */
  action?: string;
  /** Arbitrary metadata preserved across serialisation round-trips. */
  [key: string]: unknown;
}

/**
 * Signature of a function that persists the edited step list. The library
 * calls it when the user clicks **Save** in the authoring editor. The host
 * decides where the data goes. Throwing or rejecting makes the overlay show
 * an error state and fall back to copying the JSON to the clipboard.
 */
export type SaveHandler = (steps: TutorialStep[]) => void | Promise<void>;

/**
 * Minimal `<img>` replacement that can accept either a plain HTML element
 * or a framework-specific component such as `next/image`. The library
 * passes width, height, src, alt and style, and nothing else.
 */
export type ImageLike = React.ComponentType<{
  src: string;
  alt: string;
  width: number;
  height: number;
  style?: React.CSSProperties;
}>;

/**
 * Resolves whether the authoring editor should be accessible.
 *
 * Accepted shapes:
 *
 * - `true` / `false` — explicit on/off, overrides everything else.
 * - `"auto"` (default when prop is omitted) — on in development
 *   (`process.env.NODE_ENV === "development"`), off in production.
 * - `() => boolean` — a plain predicate called on every render. Use for
 *   pure, synchronous checks (feature flags held in React state you
 *   already own, URL query parameters, etc.).
 * - `{ useCanEdit: () => boolean }` — a user-supplied React hook. This is
 *   the correct shape when the check itself calls other hooks, e.g.
 *   reading from an auth context, `useSWR`, or `localStorage` via
 *   `useSyncExternalStore`. The wrapper object makes the intent explicit
 *   so the library can call it at a stable top-level site, respecting
 *   the Rules of Hooks.
 *
 * The library ships `useLocalStorageCanEdit` as a ready-made hook for the
 * common “toggle via `localStorage` key” case.
 */
export type CanEdit =
  | boolean
  | "auto"
  | (() => boolean)
  | { useCanEdit: () => boolean };

/**
 * Props for the `<TutorialOverlay>` component.
 */
export interface TutorialOverlayProps {
  /** Ordered list of steps. */
  steps: TutorialStep[];
  /** Index of the currently active step (controlled). */
  step: number;
  /** Called when the user navigates to a different step. */
  onStepChange: (step: number) => void;
  /** Called when the user closes or finishes the tour. */
  onClose: () => void;
  /** Hint that the host renders a dark theme. Affects default arrow/text colours. */
  isDark?: boolean;
  /** URL of an optional brand logo shown in the card header. */
  logoSrc?: string;
  /** Width of the logo in pixels. Default 44. */
  logoWidth?: number;
  /** Height of the logo in pixels. Default 14. */
  logoHeight?: number;
  /** Label shown next to the logo. Default "Guide". */
  headerLabel?: string;
  /**
   * Component used to render the logo. Defaults to a plain HTML `<img>`;
   * pass `next/image` or any other image component to opt into framework
   * integrations.
   */
  ImageComponent?: ImageLike;
  /**
   * Called when a step's `action` field is non-empty. The host decides
   * what to do with the action string.
   */
  onAction?: (action: string, stepIndex: number) => void;
  /**
   * Controls whether the authoring editor is accessible. See the
   * {@link CanEdit} documentation for all accepted shapes. Defaults to
   * `"auto"`: on in development, off in production.
   */
  canEdit?: CanEdit;
  /**
   * @deprecated since 0.2.0 — use `canEdit` instead. When set, this prop
   * takes precedence over `canEdit` to preserve existing behaviour, but
   * support will be removed in 0.3.0. A console warning is logged in
   * development when `debug` is supplied.
   *
   * Enable the visual authoring editor. When true, users can drag arrow
   * tips, adjust per-step arrow style via sliders, reposition and resize
   * annotation circles, and save the resulting step list via `onSave`.
   */
  debug?: boolean;
  /**
   * Invoked when the user clicks Save in the authoring editor. Receives the
   * full updated step list as a plain-object array. If this prop is omitted,
   * Save falls back to copying the JSON to the clipboard.
   */
  onSave?: SaveHandler;
  /** Called after a successful `onSave`. Typically used to re-fetch steps. */
  onSaved?: () => void;
}