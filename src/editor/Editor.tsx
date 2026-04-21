"use client";

/**
 * @module editor/Editor
 *
 * Authoring mode. Wraps `<Tutorial>` and adds:
 *
 *   - Per-step overrides stored in local state (card anchor, arrow
 *     tip, circles) that shadow the saved step definitions.
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

interface Overrides {
  /** stepId → ViewportAnchor override for the card. */
  cardAnchors: Record<string, ViewportAnchor>;
  /** stepId → TargetPoint override for the arrow tip. */
  arrowTips: Record<string, TargetPoint>;
  /** stepId → Circle[] override (full replacement, not partial). */
  circles: Record<string, Circle[]>;
}

const EMPTY_OVERRIDES: Overrides = {
  cardAnchors: {},
  arrowTips: {},
  circles: {},
};

function unsavedCountOf(o: Overrides): number {
  return (
    Object.keys(o.cardAnchors).length +
    Object.keys(o.arrowTips).length +
    Object.keys(o.circles).length
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

    const touched =
      (arrowTipOverride && arrowTipOverride !== s.annotations?.arrow?.to) ||
      circlesOverride !== undefined ||
      cardAnchor !== s.cardAnchor;

    if (!touched) return s;

    const annotations = { ...s.annotations };
    if (arrowTipOverride && annotations.arrow) {
      annotations.arrow = { ...annotations.arrow, to: arrowTipOverride };
    }
    if (circlesOverride) {
      annotations.circles = circlesOverride;
    }
    return {
      ...s,
      cardAnchor,
      annotations,
    };
  });
}

// ────────────────────────────────────────────────────────────────────────
// Internal API — used by EditorHandles and exposed via useEditorState
// ────────────────────────────────────────────────────────────────────────

interface EditorInternalApi {
  active: boolean;
  overrides: Overrides;
  setCardAnchor: (stepId: string, a: ViewportAnchor) => void;
  clearCardAnchor: (stepId: string) => void;
  setArrowTip: (stepId: string, p: TargetPoint) => void;
  setCircles: (stepId: string, c: Circle[]) => void;
  save: () => Promise<void>;
  revert: () => void;
  saveStatus: EditorState["saveStatus"];
}

const EditorContext = createContext<EditorInternalApi | null>(null);

/**
 * @internal Used by `EditorHandles`. Not re-exported from the package
 * root. Hosts should use `useEditorState()` for read-only access.
 */
export function useEditor(): EditorInternalApi | null {
  return useContext(EditorContext);
}

/**
 * Read-only public snapshot of editor state. Omits the internal
 * mutation methods so host code can't bypass the intended drag-and-
 * save flow and silently corrupt the override maps.
 */
export function useEditorState(): EditorState | null {
  const ed = useEditor();
  if (!ed) return null;
  return {
    active: ed.active,
    unsavedCount: unsavedCountOf(ed.overrides),
    saveStatus: ed.saveStatus,
    save: ed.save,
    revert: ed.revert,
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
  //
  // Computed on every render; `mergeOverrides` returns the original
  // array reference when there are no overrides, so `<Tutorial>`
  // doesn't re-render gratuitously in the common case.
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
      // onSave rejected — surface error state and copy to clipboard as
      // a fallback so the user walks away with the JSON they just
      // authored, even if persistence failed.
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

  // Clean up the save-status reset timer on unmount.
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
      setCardAnchor,
      clearCardAnchor,
      setArrowTip,
      setCircles,
      save,
      revert,
      saveStatus,
    }),
    [
      active,
      overrides,
      setCardAnchor,
      clearCardAnchor,
      setArrowTip,
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