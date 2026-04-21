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
 * (e.g. `highlight`, `tumors`, `colorMode` in the original MuTopia use)
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
 * calls it when the user clicks **Save** in debug mode. The host decides
 * where the data goes — POST it to a backend, write to localStorage, copy
 * to clipboard, whatever. Throwing or rejecting makes the overlay show an
 * error state and fall back to copying the JSON to the clipboard.
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
   * Enable the visual authoring editor. When true, users can drag arrow
   * tips, adjust per-step arrow style via sliders, reposition and resize
   * annotation circles, and save the resulting step list via `onSave`.
   */
  debug?: boolean;
  /**
   * Invoked when the user clicks Save in debug mode. Receives the full
   * updated step list as a plain-object array. If this prop is omitted,
   * Save falls back to copying the JSON to the clipboard.
   */
  onSave?: SaveHandler;
  /** Called after a successful `onSave`. Typically used to re-fetch steps. */
  onSaved?: () => void;
}
