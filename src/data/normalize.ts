/**
 * @module data/normalize
 *
 * Turns loose JSON into `Step` objects.
 *
 * Tutorials are authored by dragging things around and saving JSON, so
 * the wire format drifts: files written by 0.2 use flat fields
 * (`target`, `arrowTo`, `circles`), files written by 0.3+ use nested
 * `annotations`. Hosts were writing their own adapters to cope. This
 * module is that adapter, once, in the library.
 *
 * Two guarantees callers can rely on:
 *
 *   - **Idempotent.** `normalizeSteps(normalizeSteps(x))` deep-equals
 *     `normalizeSteps(x)`, so a step round-trips through save → load
 *     unchanged and the editor never shows phantom diffs.
 *   - **Lossless.** Fields the library does not recognise are moved into
 *     `step.meta` rather than dropped, so host-owned data survives an
 *     edit-and-save cycle.
 *
 * Pure: no DOM, no React. Safe to import on the server.
 */

import { targetPoint, viewportAnchor } from "../coords";
import type {
  Annotations,
  ArrowStyle,
  Step,
  TargetPoint,
  TriggerConfig,
  ViewportAnchor,
} from "../types";

// ── Wire shapes ─────────────────────────────────────────────────────────

/** Anything a tutorial file may contain at the top level. */
export type RawTutorial =
  | unknown[]
  | { steps?: unknown; trigger?: unknown; triggerConfig?: unknown; version?: unknown }
  | null
  | undefined;

export interface NormalizedTutorial<Meta = never> {
  steps: Step<Meta>[];
  trigger?: TriggerConfig;
  /** Payload format version. Files written by this library carry 1. */
  version: number;
}

/** Step fields the library owns. Everything else is host metadata. */
const KNOWN_STEP_KEYS = new Set([
  "id", "title", "body", "content", "targets", "selector", "annotations",
  "cardAnchor", "scrollIntoView", "actions", "waitFor", "autoAdvance",
  "highlight", "transition", "meta",
]);

/** Flat 0.2 fields that map onto a 0.3+ field rather than into `meta`. */
const LEGACY_STEP_KEYS = new Set([
  "target", "arrowTo", "arrowStyle", "targetLabel", "circles", "spotlight", "labels",
]);

// ── Helpers ─────────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Accept `{x,y}` (0.2) or a tagged `TargetPoint` (0.3+). */
function toTargetPoint(v: unknown): TargetPoint | undefined {
  if (!isRecord(v)) return undefined;
  const x = asNumber(v.x);
  const y = asNumber(v.y);
  if (x === undefined || y === undefined) return undefined;
  return v.space === "target" ? (v as unknown as TargetPoint) : targetPoint(x, y);
}

/** Accept `{x,y}` (0.2) or a tagged `ViewportAnchor` (0.3+). */
function toViewportAnchor(v: unknown): ViewportAnchor | undefined {
  if (!isRecord(v)) return undefined;
  const x = asNumber(v.x);
  const y = asNumber(v.y);
  if (x === undefined || y === undefined) return undefined;
  return v.space === "viewport" ? (v as unknown as ViewportAnchor) : viewportAnchor(x, y);
}

// ── Annotations ─────────────────────────────────────────────────────────

function normalizeAnnotations(raw: Record<string, unknown>): Annotations | undefined {
  // A nested `annotations` block is already the 0.3+ shape; normalise its
  // inner points so an untagged `arrow.to` from a hand-edited file works.
  const nested = isRecord(raw.annotations) ? { ...raw.annotations } : undefined;
  const out: Annotations = {};

  if (nested) {
    if (isRecord(nested.arrow)) {
      const to = toTargetPoint((nested.arrow as Record<string, unknown>).to);
      if (to) out.arrow = { ...(nested.arrow as object), to } as Annotations["arrow"];
    }
    if (Array.isArray(nested.circles) && nested.circles.length > 0) {
      out.circles = nested.circles as Annotations["circles"];
    }
    if (nested.spotlight === true) out.spotlight = true;
    if (Array.isArray(nested.labels) && nested.labels.length > 0) {
      out.labels = nested.labels as Annotations["labels"];
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }

  // Flat 0.2 shape.
  const arrowTo = toTargetPoint(raw.arrowTo);
  if (arrowTo) {
    out.arrow = {
      to: arrowTo,
      ...(isRecord(raw.arrowStyle) ? { style: raw.arrowStyle as ArrowStyle } : {}),
      ...(typeof raw.targetLabel === "string" ? { label: raw.targetLabel } : {}),
    } as Annotations["arrow"];
  }
  if (Array.isArray(raw.circles) && raw.circles.length > 0) {
    out.circles = raw.circles as Annotations["circles"];
  }
  if (raw.spotlight === true) out.spotlight = true;
  if (Array.isArray(raw.labels) && raw.labels.length > 0) {
    out.labels = raw.labels as Annotations["labels"];
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// ── Step ────────────────────────────────────────────────────────────────

/**
 * Normalise one raw entry into a `Step`.
 *
 * @param index Position in the file, used to synthesise an id when the
 *   entry has none. Ids matter: they are the tour's addressing scheme.
 */
export function normalizeStep<Meta = never>(raw: unknown, index = 0): Step<Meta> {
  if (!isRecord(raw)) {
    return { id: `step-${index + 1}` } as Step<Meta>;
  }

  const id =
    typeof raw.id === "string" && raw.id.trim() !== "" ? raw.id : `step-${index + 1}`;

  // 0.2 used a scalar `target`; 0.3+ uses `targets: string[]`.
  const targets = Array.isArray(raw.targets)
    ? (raw.targets as string[])
    : typeof raw.target === "string"
      ? [raw.target]
      : undefined;

  const annotations = normalizeAnnotations(raw);
  const cardAnchor = toViewportAnchor(raw.cardAnchor);

  // 0.2 overloaded `highlight` as a string id of a host-side highlight
  // target. 0.3+ uses it for the ring effect. A string means the former,
  // so it belongs in meta.
  const highlightIsLegacyString = typeof raw.highlight === "string";

  // Anything unrecognised is host metadata. Merging (rather than
  // replacing) keeps normalisation idempotent for already-lifted steps.
  const extras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (KNOWN_STEP_KEYS.has(key) || LEGACY_STEP_KEYS.has(key)) continue;
    if (value !== undefined) extras[key] = value;
  }
  if (highlightIsLegacyString) extras.highlight = raw.highlight;
  const existingMeta = isRecord(raw.meta) ? raw.meta : undefined;
  const meta =
    existingMeta || Object.keys(extras).length > 0
      ? { ...extras, ...(existingMeta ?? {}) }
      : undefined;

  const step: Step<Meta> = { id };

  if (typeof raw.title === "string") step.title = raw.title;
  if (typeof raw.body === "string") step.body = raw.body;
  if (targets && targets.length > 0) step.targets = targets;
  if (typeof raw.selector === "string") step.selector = raw.selector;
  if (annotations) step.annotations = annotations;
  if (cardAnchor) step.cardAnchor = cardAnchor;
  if (raw.scrollIntoView != null) step.scrollIntoView = raw.scrollIntoView as Step["scrollIntoView"];
  if (Array.isArray(raw.actions)) step.actions = raw.actions as Step["actions"];
  if (isRecord(raw.waitFor)) step.waitFor = raw.waitFor as Step["waitFor"];
  if (asNumber(raw.autoAdvance) !== undefined) step.autoAdvance = raw.autoAdvance as number;
  if (raw.highlight != null && !highlightIsLegacyString) {
    step.highlight = raw.highlight as Step["highlight"];
  }
  if (isRecord(raw.transition)) step.transition = raw.transition as Step["transition"];
  if (meta) step.meta = meta as Meta;

  return step;
}

// ── Tutorial payload ────────────────────────────────────────────────────

/**
 * Normalise a whole tutorial file. Accepts either a bare array of steps
 * (the 0.2/0.3 on-disk format) or a `{ steps, trigger }` envelope.
 */
export function normalizeTutorial<Meta = never>(raw: RawTutorial): NormalizedTutorial<Meta> {
  if (Array.isArray(raw)) {
    return { steps: raw.map((s, i) => normalizeStep<Meta>(s, i)), version: 1 };
  }
  if (isRecord(raw)) {
    const list = Array.isArray(raw.steps) ? raw.steps : [];
    const rawTrigger = raw.trigger ?? raw.triggerConfig;
    return {
      steps: list.map((s, i) => normalizeStep<Meta>(s, i)),
      ...(isRecord(rawTrigger) ? { trigger: rawTrigger as TriggerConfig } : {}),
      version: asNumber(raw.version) ?? 1,
    };
  }
  return { steps: [], version: 1 };
}

/** Convenience: just the steps. */
export function normalizeSteps<Meta = never>(raw: RawTutorial): Step<Meta>[] {
  return normalizeTutorial<Meta>(raw).steps;
}
