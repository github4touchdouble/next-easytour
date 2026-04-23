"use client";

/**
 * @module editor/Editor
 *
 * Authoring mode. Wraps `<Tutorial>` and adds:
 *
 *   - Per-step overrides stored in local state (card anchor, arrow
 *     tip, full arrow creation, circles) that shadow the saved step
 *     definitions.
 *   - Drag handles on the card (to reposition) and on the arrow tip
 *     (to re-aim), mounted via `<EditorHandles />`.
 *   - A keyboard-accessible save / revert surface exposed through
 *     `useEditorState()`, so hosts can render their own button or
 *     status indicator.
 *
 * The Editor is a **props-transforming wrapper**, not a context peer
 * of the Tutorial. It computes a shadow step list (original steps
 * with overrides merged) and hands it to a render-prop so the host
 * composes the Tutorial:
 *
 *     <Editor steps={original} canEdit={isAdmin} onSave={save}>
 *       {({ steps }) => (
 *         <Tutorial
 *           steps={steps}
 *           stepId={stepId}
 *           onStepChange={setStepId}
 *         >
 *           <Card />
 *           <Arrow />
 *           <EditorHandles />
 *         </Tutorial>
 *       )}
 *     </Editor>
 *
 * This layering keeps the core Tutorial + Card + Arrow completely
 * unaware of the editor. They read `step.cardAnchor`; it happens to
 * reflect the author's in-progress drag. Save writes the overrides
 * into the base steps and clears the local state.
 *
 * ── Changes in 0.3.0-alpha.1 ─────────────────────────────────────
 *
 *   - `mergeOverrides` now constructs a minimal `annotations.arrow`
 *     when an arrow-tip override targets a step that didn't previously
 *     have an arrow. This lets authors seed arrows from scratch in the
 *     editor without having to pre-populate the JSON.
 *
 *   - A new `setArrow(stepId, spec)` mutator seeds both `targets` (if
 *     empty) and `annotations.arrow` in one call — the preferred entry
 *     point for "+ Add arrow" UIs.
 *
 *   - `useEditorState()` now exposes all four mutators
 *     (setCardAnchor, clearCardAnchor, setArrowTip, setArrow, setCircles)
 *     alongside the existing read-only fields. Mutators are `undefined`
 *     when the editor is inactive, so read-only callers stay type-safe.
 */

import * as React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  Arrow,
  CanEdit,
  Circle,
  EditorState,
  SaveHandler,
  Step,
  TargetPoint,
  ViewportAnchor,
} from "../types";

// ────────────────────────────────────────────────────────────────────────
// Override state
// ────────────────────────────────────────────────────────────────────────
//
// The Overrides shape is unchanged from alpha.0. `setArrow` piggy-backs
// on `arrowTips` + a new `newArrows` map that carries the parts an
// arrow-tip-only override can't express (targets assignment, style,
// label). We keep the data carriers small and let `mergeOverrides`
// reconstitute the final step.

interface NewArrowOverride {
  /** Targets to add to the step if it had none. Appended, not replaced. */
  targets?: string[];
  /** Optional style pass-through to annotations.arrow.style. */
  style?: Arrow["style"];
  /** Optional label pass-through to annotations.arrow.label. */
  label?: string;
}

interface Overrides {
  /** stepId → ViewportAnchor override for the card. */
  cardAnchors: Record<string, ViewportAnchor>;
  /** stepId → TargetPoint override for the arrow tip. */
  arrowTips: Record<string, TargetPoint>;
  /** stepId → Circle[] override (full replacement, not partial). */
  circles: Record<string, Circle[]>;
  /**
   * stepId → "seed a new arrow" metadata. Used when the step didn't have
   * an arrow annotation and the author created one via `setArrow`. The
   * tip itself is stored in `arrowTips` (same key) so re-aiming with
   * `<ArrowTipHandle>` afterwards just updates the tip without losing
   * the seeded targets/style/label.
   */
  newArrows: Record<string, NewArrowOverride>;
}

const EMPTY_OVERRIDES: Overrides = {
  cardAnchors: {},
  arrowTips: {},
  circles: {},
  newArrows: {},
};

function unsavedCountOf(o: Overrides): number {
  return (
    Object.keys(o.cardAnchors).length +
    Object.keys(o.arrowTips).length +
    Object.keys(o.circles).length +
    Object.keys(o.newArrows).length
  );
}

// ────────────────────────────────────────────────────────────────────────
// canEdit resolution
// ────────────────────────────────────────────────────────────────────────

/**
 * Evaluate the `CanEdit` prop to a boolean. Three of the four shapes
 * are synchronous and can be handled inline; the hook-shape requires
 * an actual hook call, which we do unconditionally so React's rules
 * of hooks hold.
 */
function useResolveCanEdit(canEdit: CanEdit | undefined): boolean {
  // The hook-shape is the only branch that calls hooks. We call a
  // no-op constant hook in the other branches so the hook count is
  // stable across renders regardless of which form was supplied.
  const hookShape =
    typeof canEdit === "object" && canEdit !== null && "useCanEdit" in canEdit
      ? canEdit
      : null;
  // Always invoke — either the real hook or a stub — on every render.
  const fromHook = hookShape ? hookShape.useCanEdit() : false;

  if (canEdit === undefined || canEdit === "auto") {
    return (
      typeof process !== "undefined" &&
      process.env?.NODE_ENV !== "production"
    );
  }
  if (typeof canEdit === "boolean") return canEdit;
  if (typeof canEdit === "function") {
    try {
      return canEdit();
    } catch {
      return false;
    }
  }
  return fromHook;
}

// ────────────────────────────────────────────────────────────────────────
// Step-merging
// ────────────────────────────────────────────────────────────────────────

/**
 * Merge overrides into the base step list. Pure; called on every
 * render. Returns a new array only when at least one override exists
 * — otherwise returns the original array reference so downstream
 * consumers can skip work via `===`.
 *
 * alpha.1 change: the arrow-tip merge no longer requires the step to
 * already have an `annotations.arrow`. If an arrow tip override exists
 * for a step that doesn't have one, we construct a minimal arrow here.
 * `newArrows` carries target-list additions and optional style/label.
 */
function mergeOverrides<Meta>(
  steps: Step<Meta>[],
  o: Overrides,
): Step<Meta>[] {
  if (unsavedCountOf(o) === 0) return steps;
  return steps.map((s) => {
    const cardAnchor = o.cardAnchors[s.id] ?? s.cardAnchor;
    const arrowTipOverride = o.arrowTips[s.id];
    const circlesOverride = o.circles[s.id];
    const newArrowOverride = o.newArrows[s.id];

    const hasAnyOverride =
      o.cardAnchors[s.id] !== undefined ||
      arrowTipOverride !== undefined ||
      circlesOverride !== undefined ||
      newArrowOverride !== undefined;

    if (!hasAnyOverride) return s;

    // ── Build merged annotations ────────────────────────────────────────
    const annotations = { ...(s.annotations ?? {}) };

    // Arrow tip: set tip on the existing arrow if present, or construct
    // a minimal arrow if not. If a newArrow override exists it
    // contributes style/label; if not, defaults apply.
    if (arrowTipOverride !== undefined) {
      const existingArrow = annotations.arrow;
      if (existingArrow) {
        annotations.arrow = { ...existingArrow, to: arrowTipOverride };
      } else {
        annotations.arrow = {
          to: arrowTipOverride,
          ...(newArrowOverride?.style ? { style: newArrowOverride.style } : {}),
          ...(newArrowOverride?.label ? { label: newArrowOverride.label } : {}),
        };
      }
    } else if (newArrowOverride) {
      // Author called setArrow without a prior tip override (edge case —
      // setArrow always sets both, but defensively we support the case).
      // No tip to use; skip arrow creation, let the author finish their
      // drag to set the tip.
    }

    // Circles: full replacement as before.
    if (circlesOverride !== undefined) {
      annotations.circles = circlesOverride;
    }

    // ── Targets assignment (newArrows only) ─────────────────────────────
    // When setArrow supplied targets and the step had none, we merge
    // them into the targets list. Preserving any pre-existing targets
    // keeps multi-target spotlighting intact.
    const targets = (() => {
      if (!newArrowOverride?.targets || newArrowOverride.targets.length === 0) {
        return s.targets;
      }
      if (!s.targets || s.targets.length === 0) {
        return newArrowOverride.targets;
      }
      // Both present — prefer existing; don't duplicate ids.
      const existing = new Set(s.targets);
      const added = newArrowOverride.targets.filter((t) => !existing.has(t));
      return added.length === 0 ? s.targets : [...s.targets, ...added];
    })();

    return {
      ...s,
      cardAnchor,
      targets,
      annotations,
    };
  });
}

// ────────────────────────────────────────────────────────────────────────
// Internal API — used by EditorHandles and exposed via useEditorState
// ────────────────────────────────────────────────────────────────────────

/**
 * @deprecated For external consumers. Use `useEditorState()` which
 * exposes the same mutators when `active === true`. This symbol is
 * kept exported only because `<EditorHandles>` and related editor-
 * internal components reach for it; library users should never import
 * it directly.
 */
export interface EditorInternalApi {
  active: boolean;
  overrides: Overrides;
  /** The merged step list (base + overrides). */
  steps: Step<unknown>[];
  setCardAnchor: (stepId: string, a: ViewportAnchor) => void;
  clearCardAnchor: (stepId: string) => void;
  setArrowTip: (stepId: string, p: TargetPoint) => void;
  setArrow: (
    stepId: string,
    spec: {
      targets?: string[];
      to: TargetPoint;
      style?: Arrow["style"];
      label?: string;
    },
  ) => void;
  setCircles: (stepId: string, c: Circle[]) => void;
  save: () => Promise<void>;
  revert: () => void;
  saveStatus: EditorState["saveStatus"];
}

const EditorContext = createContext<EditorInternalApi | null>(null);

/**
 * @internal Used by `EditorHandles`. Not re-exported from the package
 * root. Hosts should use `useEditorState()` for a public, type-stable
 * surface.
 */
export function useEditor(): EditorInternalApi | null {
  return useContext(EditorContext);
}

/**
 * Read-only public snapshot of editor state, plus (in alpha.1+)
 * mutator methods when the editor is active. Mutators are `undefined`
 * when `active === false` so read-only callers can use the hook
 * without type gymnastics; authoring callers do an `if (editor.active)`
 * narrow before calling.
 */
export function useEditorState(): EditorState | null {
  const ed = useEditor();
  if (!ed) return null;

  // When inactive we return bare read-only fields so the mutator keys
  // are `undefined` — hosts can rely on `editor.setArrow?.()` chaining
  // to no-op safely outside admin mode.
  if (!ed.active) {
    return {
      active: false,
      unsavedCount: unsavedCountOf(ed.overrides),
      saveStatus: ed.saveStatus,
      save: ed.save,
      revert: ed.revert,
    };
  }

  return {
    active: true,
    unsavedCount: unsavedCountOf(ed.overrides),
    saveStatus: ed.saveStatus,
    save: ed.save,
    revert: ed.revert,
    setCardAnchor: ed.setCardAnchor,
    clearCardAnchor: ed.clearCardAnchor,
    setArrowTip: ed.setArrowTip,
    setArrow: ed.setArrow,
    setCircles: ed.setCircles,
  };
}

// ────────────────────────────────────────────────────────────────────────
// Editor component
// ────────────────────────────────────────────────────────────────────────

export interface EditorProps<Meta = never> {
  /** Base step list. Edited via drag; the edits live in Editor state. */
  steps: Step<Meta>[];
  /**
   * Called when the user clicks Save. Receives the full updated step
   * list (overrides merged into base). Throwing / rejecting surfaces
   * an `"error"` state and falls back to copying JSON to clipboard.
   * Omit to rely on clipboard copy alone.
   */
  onSave?: SaveHandler<Meta>;
  /** Called after a successful `onSave`. Typical use: re-fetch steps. */
  onSaved?: () => void;
  /** Gate the editor on/off. See `CanEdit` in types.ts. Default "auto". */
  canEdit?: CanEdit;
  /**
   * Render-prop. Receives the merged step list; the host uses it to
   * construct the `<Tutorial>` invocation.
   */
  children: (args: { steps: Step<Meta>[] }) => React.ReactNode;
}

export function Editor<Meta = never>(props: EditorProps<Meta>) {
  const { steps: baseSteps, onSave, onSaved, canEdit, children } = props;
  const active = useResolveCanEdit(canEdit);

  const [overrides, setOverrides] = useState<Overrides>(EMPTY_OVERRIDES);
  const [saveStatus, setSaveStatus] =
    useState<EditorState["saveStatus"]>("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Override mutators ─────────────────────────────────────────────────
  const setCardAnchor = useCallback(
    (stepId: string, a: ViewportAnchor) => {
      setOverrides((prev) => ({
        ...prev,
        cardAnchors: { ...prev.cardAnchors, [stepId]: a },
      }));
    },
    [],
  );
  const clearCardAnchor = useCallback((stepId: string) => {
    setOverrides((prev) => {
      if (!(stepId in prev.cardAnchors)) return prev;
      const next = { ...prev.cardAnchors };
      delete next[stepId];
      return { ...prev, cardAnchors: next };
    });
  }, []);
  const setArrowTip = useCallback((stepId: string, p: TargetPoint) => {
    setOverrides((prev) => ({
      ...prev,
      arrowTips: { ...prev.arrowTips, [stepId]: p },
    }));
  }, []);

  /**
   * Seed a brand-new arrow. Combines `setArrowTip` with a targets-append
   * and optional style/label in one transaction so the author doesn't
   * see an intermediate "has targets but no arrow" state.
   */
  const setArrow = useCallback(
    (
      stepId: string,
      spec: {
        targets?: string[];
        to: TargetPoint;
        style?: Arrow["style"];
        label?: string;
      },
    ) => {
      setOverrides((prev) => ({
        ...prev,
        arrowTips: { ...prev.arrowTips, [stepId]: spec.to },
        newArrows: {
          ...prev.newArrows,
          [stepId]: {
            targets: spec.targets,
            style: spec.style,
            label: spec.label,
          },
        },
      }));
    },
    [],
  );

  const setCircles = useCallback((stepId: string, c: Circle[]) => {
    setOverrides((prev) => ({
      ...prev,
      circles: { ...prev.circles, [stepId]: c },
    }));
  }, []);

  const revert = useCallback(() => {
    setOverrides(EMPTY_OVERRIDES);
    setSaveStatus("idle");
  }, []);

  // ── Merged steps ──────────────────────────────────────────────────────
  const mergedSteps = useMemo(
    () => mergeOverrides(baseSteps, overrides),
    [baseSteps, overrides],
  );

  // ── Save ──────────────────────────────────────────────────────────────
  const save = useCallback(async () => {
    const payload = mergeOverrides(baseSteps, overrides);
    setSaveStatus("saving");
    const clearLater = () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
    };
    try {
      if (onSave) {
        await onSave(payload);
      } else {
        await navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
      }
      setSaveStatus("saved");
      setOverrides(EMPTY_OVERRIDES);
      onSaved?.();
      clearLater();
    } catch {
      try {
        await navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
      } catch {
        /* nothing we can do silently */
      }
      setSaveStatus("error");
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }, [baseSteps, overrides, onSave, onSaved]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // ── Context value ─────────────────────────────────────────────────────
  const internal = useMemo<EditorInternalApi>(
    () => ({
      active,
      overrides,
      steps: mergedSteps as Step<unknown>[],
      setCardAnchor,
      clearCardAnchor,
      setArrowTip,
      setArrow,
      setCircles,
      save,
      revert,
      saveStatus,
    }),
    [
      active,
      overrides,
      mergedSteps,
      setCardAnchor,
      clearCardAnchor,
      setArrowTip,
      setArrow,
      setCircles,
      save,
      revert,
      saveStatus,
    ],
  );

  return (
    <EditorContext.Provider value={internal}>
      {children({ steps: mergedSteps })}
    </EditorContext.Provider>
  );
}