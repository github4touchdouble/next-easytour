"use client";

/**
 * @module editor/Editor
 *
 * Authoring mode. Alpha.7 extends with full CRUD:
 *   - addStep / removeStep / updateStep / moveStep
 *   - stepEdits: per-step field patches (title, body, selector, etc.)
 *   - addedSteps / removedIds for structural changes
 *
 * All mutations are local until Save is called.
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
  TriggerConfig,
  ViewportAnchor,
} from "../types";

// ── Override state ──────────────────────────────────────────────────────

interface NewArrowOverride {
  targets?: string[];
  style?: Arrow["style"];
  label?: string;
}

interface Overrides {
  cardAnchors: Record<string, ViewportAnchor>;
  arrowTips: Record<string, TargetPoint>;
  circles: Record<string, Circle[]>;
  newArrows: Record<string, NewArrowOverride>;
  /** alpha.7: per-step field patches (title, body, selector, etc.) */
  stepEdits: Record<string, Partial<Step<unknown>>>;
  /** alpha.7: new steps added in the editor */
  addedSteps: Step<unknown>[];
  /** alpha.7: step IDs marked for removal */
  removedIds: string[];
  /** alpha.8: global card position for all steps without their own override. */
  defaultCardAnchor?: ViewportAnchor;
  /** alpha.20: trigger button configuration. */
  triggerConfig?: TriggerConfig;
}

const EMPTY_OVERRIDES: Overrides = {
  cardAnchors: {},
  arrowTips: {},
  circles: {},
  newArrows: {},
  stepEdits: {},
  addedSteps: [],
  removedIds: [],
  defaultCardAnchor: undefined,
  triggerConfig: undefined,
};

function unsavedCountOf(o: Overrides): number {
  return (
    Object.keys(o.cardAnchors).length +
    Object.keys(o.arrowTips).length +
    Object.keys(o.circles).length +
    Object.keys(o.newArrows).length +
    Object.keys(o.stepEdits).length +
    o.addedSteps.length +
    o.removedIds.length +
    (o.defaultCardAnchor ? 1 : 0) +
    (o.triggerConfig ? 1 : 0)
  );
}

// ── canEdit resolution ──────────────────────────────────────────────────

function useResolveCanEdit(canEdit: CanEdit | undefined): boolean {
  const hookShape =
    typeof canEdit === "object" && canEdit !== null && "useCanEdit" in canEdit
      ? canEdit
      : null;
  const fromHook = hookShape ? hookShape.useCanEdit() : false;
  if (canEdit === undefined || canEdit === "auto") {
    return typeof process !== "undefined" && process.env?.NODE_ENV !== "production";
  }
  if (typeof canEdit === "boolean") return canEdit;
  if (typeof canEdit === "function") {
    try { return canEdit(); } catch { return false; }
  }
  return fromHook;
}

// ── Step merging ────────────────────────────────────────────────────────

function mergeOverrides<Meta>(steps: Step<Meta>[], o: Overrides): Step<Meta>[] {
  // 1. Filter removed
  let result = steps.filter((s) => !o.removedIds.includes(s.id));

  // 2. Apply overrides + stepEdits
  result = result.map((s) => {
    // Per-step cardAnchor > step's own > global default override
    const cardAnchor = o.cardAnchors[s.id] ?? s.cardAnchor ?? o.defaultCardAnchor;
    const arrowTipOverride = o.arrowTips[s.id];
    const circlesOverride = o.circles[s.id];
    const newArrowOverride = o.newArrows[s.id];
    const edit = o.stepEdits[s.id] as Partial<Step<Meta>> | undefined;

    const hasAnyOverride =
      o.cardAnchors[s.id] !== undefined ||
      arrowTipOverride !== undefined ||
      circlesOverride !== undefined ||
      newArrowOverride !== undefined ||
      edit !== undefined ||
      (o.defaultCardAnchor !== undefined && !s.cardAnchor);

    if (!hasAnyOverride) return s;

    // Build merged annotations.
    // If the editor panel provides annotations (edit?.annotations), use
    // that as the base — it's the source of truth for what overlays are
    // on/off. Arrow tip and circles drag overrides apply on top.
    const annotations = edit?.annotations !== undefined
      ? { ...(edit.annotations) }
      : { ...(s.annotations ?? {}) };

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
    }

    if (circlesOverride !== undefined) {
      annotations.circles = circlesOverride;
    }

    const targets = (() => {
      if (edit?.targets) return edit.targets;
      if (!newArrowOverride?.targets || newArrowOverride.targets.length === 0) return s.targets;
      if (!s.targets || s.targets.length === 0) return newArrowOverride.targets;
      const existing = new Set(s.targets);
      const added = newArrowOverride.targets.filter((t) => !existing.has(t));
      return added.length === 0 ? s.targets : [...s.targets, ...added];
    })();

    return {
      ...s,
      ...(edit ?? {}),
      cardAnchor,
      targets,
      annotations,
    };
  });

  // 3. Append added steps
  if (o.addedSteps.length > 0) {
    result = [...result, ...(o.addedSteps as Step<Meta>[])];
  }

  return result;
}

// ── Internal API ────────────────────────────────────────────────────────

export interface EditorInternalApi {
  active: boolean;
  overrides: Overrides;
  steps: Step<unknown>[];
  setCardAnchor: (stepId: string, a: ViewportAnchor) => void;
  clearCardAnchor: (stepId: string) => void;
  setArrowTip: (stepId: string, p: TargetPoint) => void;
  setArrow: (stepId: string, spec: { targets?: string[]; to: TargetPoint; style?: Arrow["style"]; label?: string }) => void;
  setCircles: (stepId: string, c: Circle[]) => void;
  /** alpha.7: update any step fields */
  updateStep: (stepId: string, patch: Partial<Step<unknown>>) => void;
  /** alpha.7: add a new step */
  addStep: (step: Step<unknown>) => void;
  /** alpha.7: remove a step */
  removeStep: (stepId: string) => void;
  /** alpha.7: move a step up or down */
  moveStep: (stepId: string, direction: "up" | "down") => void;
  /** alpha.8: set card position for ALL steps (global default). */
  setDefaultCardAnchor: (a: ViewportAnchor) => void;
  /** alpha.26: clear all per-step card positions so every step uses the global default. */
  resetAllCardAnchors: () => void;
  /** alpha.20: trigger button config. */
  triggerConfig?: TriggerConfig;
  setTriggerConfig: (config: TriggerConfig) => void;
  save: () => Promise<void>;
  revert: () => void;
  saveStatus: EditorState["saveStatus"];
}

const EditorContext = createContext<EditorInternalApi | null>(null);

export function useEditor(): EditorInternalApi | null {
  return useContext(EditorContext);
}

export function useEditorState(): EditorState | null {
  const ed = useEditor();
  if (!ed) return null;
  if (!ed.active) {
    return {
      active: false, unsavedCount: unsavedCountOf(ed.overrides),
      saveStatus: ed.saveStatus, save: ed.save, revert: ed.revert,
    };
  }
  return {
    active: true, unsavedCount: unsavedCountOf(ed.overrides),
    saveStatus: ed.saveStatus, save: ed.save, revert: ed.revert,
    setCardAnchor: ed.setCardAnchor, clearCardAnchor: ed.clearCardAnchor,
    setArrowTip: ed.setArrowTip, setArrow: ed.setArrow, setCircles: ed.setCircles,
  };
}

// ── Editor component ────────────────────────────────────────────────────

export interface EditorProps<Meta = never> {
  steps: Step<Meta>[];
  onSave?: SaveHandler<Meta>;
  onSaved?: () => void;
  canEdit?: CanEdit;
  /** Current trigger button config — the panel shows these as defaults. */
  triggerConfig?: TriggerConfig;
  children: (args: { steps: Step<Meta>[] }) => React.ReactNode;
}

export function Editor<Meta = never>(props: EditorProps<Meta>) {
  const { steps: baseSteps, onSave, onSaved, canEdit, triggerConfig: baseTriggerConfig, children } = props;
  const active = useResolveCanEdit(canEdit);

  const [overrides, setOverrides] = useState<Overrides>(EMPTY_OVERRIDES);
  const [saveStatus, setSaveStatus] = useState<EditorState["saveStatus"]>("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Existing mutators ─────────────────────────────────────────────────

  const setCardAnchor = useCallback((stepId: string, a: ViewportAnchor) => {
    setOverrides((p) => ({ ...p, cardAnchors: { ...p.cardAnchors, [stepId]: a } }));
  }, []);

  const clearCardAnchor = useCallback((stepId: string) => {
    setOverrides((p) => {
      if (!(stepId in p.cardAnchors)) return p;
      const next = { ...p.cardAnchors }; delete next[stepId];
      return { ...p, cardAnchors: next };
    });
  }, []);

  const setArrowTip = useCallback((stepId: string, pt: TargetPoint) => {
    setOverrides((p) => ({ ...p, arrowTips: { ...p.arrowTips, [stepId]: pt } }));
  }, []);

  const setArrow = useCallback((stepId: string, spec: { targets?: string[]; to: TargetPoint; style?: Arrow["style"]; label?: string }) => {
    setOverrides((p) => ({
      ...p,
      arrowTips: { ...p.arrowTips, [stepId]: spec.to },
      newArrows: { ...p.newArrows, [stepId]: { targets: spec.targets, style: spec.style, label: spec.label } },
    }));
  }, []);

  const setCircles = useCallback((stepId: string, c: Circle[]) => {
    setOverrides((p) => ({ ...p, circles: { ...p.circles, [stepId]: c } }));
  }, []);

  // ── alpha.7 CRUD mutators ─────────────────────────────────────────────

  const updateStep = useCallback((stepId: string, patch: Partial<Step<unknown>>) => {
    setOverrides((p) => ({
      ...p,
      stepEdits: {
        ...p.stepEdits,
        [stepId]: { ...(p.stepEdits[stepId] ?? {}), ...patch },
      },
    }));
  }, []);

  const addStep = useCallback((step: Step<unknown>) => {
    setOverrides((p) => ({
      ...p,
      addedSteps: [...p.addedSteps, step],
    }));
  }, []);

  const removeStep = useCallback((stepId: string) => {
    setOverrides((p) => ({
      ...p,
      removedIds: [...p.removedIds, stepId],
      // Clean up any edits for the removed step
      addedSteps: p.addedSteps.filter((s) => s.id !== stepId),
    }));
  }, []);

  const moveStep = useCallback((stepId: string, direction: "up" | "down") => {
    // moveStep works on the merged list by rewriting base + added order.
    // For simplicity, we re-emit the full step list as "added" and clear base.
    // This is a bit heavy but correct.
    setOverrides((p) => {
      const merged = mergeOverrides(baseSteps, p);
      const idx = merged.findIndex((s) => s.id === stepId);
      if (idx < 0) return p;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= merged.length) return p;
      const arr = [...merged];
      [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
      // Encode as: remove all base steps, add them back in new order
      return {
        ...p,
        removedIds: baseSteps.map((s) => s.id),
        addedSteps: arr as Step<unknown>[],
        // Clear per-step overrides since they're baked into addedSteps now
        cardAnchors: {},
        arrowTips: {},
        circles: {},
        newArrows: {},
        stepEdits: {},
      };
    });
  }, [baseSteps]);

  const setDefaultCardAnchor = useCallback((a: ViewportAnchor) => {
    setOverrides((p) => ({ ...p, defaultCardAnchor: a }));
  }, []);

  const resetAllCardAnchors = useCallback(() => {
    setOverrides((p) => {
      // Clear all per-step anchors + clear step edits that contain cardAnchor
      const cleanedEdits = { ...p.stepEdits };
      for (const [id, edit] of Object.entries(cleanedEdits)) {
        if (edit?.cardAnchor) {
          const { cardAnchor, ...rest } = edit;
          cleanedEdits[id] = rest;
        }
      }
      return { ...p, cardAnchors: {}, stepEdits: cleanedEdits };
    });
  }, []);

  const setTriggerConfig = useCallback((config: TriggerConfig) => {
    setOverrides((p) => ({ ...p, triggerConfig: { ...(p.triggerConfig ?? {}), ...config } }));
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
    const triggerCfg = overrides.triggerConfig;
    setSaveStatus("saving");
    const clearLater = () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
    };
    try {
      if (onSave) {
        await onSave(payload, triggerCfg ? { triggerConfig: triggerCfg } : undefined);
      } else {
        const clipData = triggerCfg
          ? { steps: payload, triggerConfig: triggerCfg }
          : payload;
        await navigator.clipboard?.writeText(JSON.stringify(clipData, null, 2));
      }
      setSaveStatus("saved");
      setOverrides(EMPTY_OVERRIDES);
      onSaved?.();
      clearLater();
    } catch {
      try {
        const clipData = triggerCfg
          ? { steps: payload, triggerConfig: triggerCfg }
          : payload;
        await navigator.clipboard?.writeText(JSON.stringify(clipData, null, 2));
      } catch {}
      setSaveStatus("error");
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }, [baseSteps, overrides, onSave, onSaved]);

  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); }, []);

  // ── Context ───────────────────────────────────────────────────────────
  const internal = useMemo<EditorInternalApi>(
    () => ({
      active, overrides,
      steps: mergedSteps as Step<unknown>[],
      setCardAnchor, clearCardAnchor, setArrowTip, setArrow, setCircles,
      updateStep, addStep, removeStep, moveStep,
      setDefaultCardAnchor,
      resetAllCardAnchors,
      triggerConfig: overrides.triggerConfig
        ? { ...(baseTriggerConfig ?? {}), ...overrides.triggerConfig }
        : baseTriggerConfig,
      setTriggerConfig,
      save, revert, saveStatus,
    }),
    [active, overrides, mergedSteps, setCardAnchor, clearCardAnchor,
     setArrowTip, setArrow, setCircles, updateStep, addStep, removeStep,
     moveStep, setDefaultCardAnchor, resetAllCardAnchors, setTriggerConfig, baseTriggerConfig, save, revert, saveStatus],
  );

  return (
    <EditorContext.Provider value={internal}>
      {children({ steps: mergedSteps })}
    </EditorContext.Provider>
  );
}