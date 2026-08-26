"use client";

/**
 * @module core/TutorialStage
 *
 * Renders the tour: editor wrapper, provider, overlays, authoring chrome.
 *
 * Everything it needs comes from `<TutorialProvider>`, so it takes no
 * required props. It renders nothing at all unless the tour is both
 * available (enabled, media matches, steps loaded) and open — which is
 * the gate hosts previously wrote by hand in JSX.
 */

import * as React from "react";
import { useCallback } from "react";
import { Tutorial } from "./Tutorial";
import { useTourInternal } from "./TutorialProvider";
import { Editor } from "../editor/Editor";
import { Card, type CardRenderArgs } from "../overlay/Card";
import { Arrow } from "../overlay/Arrow";
import { Circles } from "../overlay/Circles";
import { Labels } from "../overlay/Labels";
import { Spotlight } from "../overlay/Spotlight";
import type { Step, TriggerConfig } from "../types";

// ── Overlay selection ───────────────────────────────────────────────────

export interface OverlayToggles {
  spotlight?: boolean;
  arrow?: boolean;
  circles?: boolean;
  labels?: boolean;
  card?: boolean;
}

const ALL_OVERLAYS: Required<OverlayToggles> = {
  spotlight: true, arrow: true, circles: true, labels: true, card: true,
};
const NO_OVERLAYS: Required<OverlayToggles> = {
  spotlight: false, arrow: false, circles: false, labels: false, card: false,
};

function resolveOverlays(overlays: boolean | OverlayToggles | undefined): Required<OverlayToggles> {
  if (overlays === undefined || overlays === true) return ALL_OVERLAYS;
  if (overlays === false) return NO_OVERLAYS;
  return { ...ALL_OVERLAYS, ...overlays };
}

// ── Props ───────────────────────────────────────────────────────────────

export interface TutorialStageProps<Meta = never> {
  /**
   * Custom card renderer. The default overlays stay on, so branding the
   * card costs one prop rather than re-listing every overlay.
   */
  card?: (args: CardRenderArgs<Meta>) => React.ReactNode;
  /** Turn built-in overlays off, individually or all at once. */
  overlays?: boolean | OverlayToggles;
  /** Extra overlays, rendered inside the tour after the built-ins. */
  children?: React.ReactNode;

  onOpen?: () => void;
  onClose?: () => void;
  onStepEnter?: (step: Step<Meta>, index: number) => void;
  onStepLeave?: (step: Step<Meta>, index: number) => void;
  canAdvance?: (step: Step<Meta>, index: number) => boolean;
  /** Suppress the card's arrow-key / Escape handling. */
  disableKeyboard?: boolean;
}

// ── Component ───────────────────────────────────────────────────────────

export function TutorialStage<Meta = never>(props: TutorialStageProps<Meta>) {
  const {
    card, overlays, children,
    onOpen, onClose, onStepEnter, onStepLeave, canAdvance, disableKeyboard,
  } = props;

  const tour = useTourInternal<Meta>();
  if (!tour) {
    throw new Error(
      "[next-easytour] <TutorialStage> rendered outside <TutorialProvider>. " +
        "Wrap the page in <TutorialProvider config={…}>.",
    );
  }

  const show = resolveOverlays(overlays);
  const { config, editor, editorChunk, handleSave, handleSaved, trigger } = tour;

  // Authoring needs both the permission *and* the chunk that implements
  // it. In production `editorChunk` is permanently null, so the branches
  // below are unreachable and the components are never imported.
  const editing = editor.active && editorChunk !== null;

  // Completion bookkeeping runs first, then the host's own callback, so
  // a host handler that throws cannot lose the completion write.
  const handleStepEnter = useCallback(
    (step: Step<Meta>, index: number) => {
      tour.noteStepEnter(step);
      onStepEnter?.(step, index);
    },
    [tour, onStepEnter],
  );

  const saveHandler = useCallback(
    async (nextSteps: Step<Meta>[], options?: { triggerConfig?: TriggerConfig }) => {
      if (!handleSave) throw new Error("[next-easytour] this store is read-only");
      await handleSave(nextSteps, options?.triggerConfig);
    },
    [handleSave],
  );

  if (!tour.available || !tour.isOpen) return null;

  const inner = (steps: Step<Meta>[]) => (
    <Tutorial<Meta>
      steps={steps}
      stepId={tour.stepId}
      onStepChange={tour.setStepId}
      onOpen={onOpen}
      onClose={onClose}
      onStepEnter={handleStepEnter}
      onStepLeave={onStepLeave}
      canAdvance={canAdvance}
      theme={config.theme}
      transition={config.transition}
      scrollIntoView={config.scrollIntoView}
      cardPositioning={config.card.positioning}
      defaultCardAnchor={config.card.anchor}
    >
      {show.spotlight && <Spotlight />}
      {show.arrow && <Arrow />}
      {show.circles && <Circles />}
      {show.labels && <Labels />}
      {show.card && (
        <Card<Meta> disableKeyboard={disableKeyboard}>
          {card ? (args) => card(args) : undefined}
        </Card>
      )}
      {children}
      {/* Authoring chrome gates itself on the editor being active, so
          the host never repeats its own permission check here. */}
      {editing && config.editor.handles && <editorChunk.EditorHandles />}
      {editing && config.editor.panel && <editorChunk.EditorPanel />}
    </Tutorial>
  );

  // Skip the editor wrapper entirely when nobody is editing: no shadow
  // step list, no override merging, no context. Toggling the unlock
  // therefore remounts the overlays — the open step survives (the
  // provider owns it), but the card re-measures. The chunk is fetched as
  // soon as a user is *allowed*, so in practice it is already in memory
  // when they unlock and this swap does not wait on the network.
  if (!editing) return inner(tour.steps);

  return (
    <Editor<Meta>
      steps={tour.steps}
      canEdit
      triggerConfig={trigger}
      onSave={handleSave ? saveHandler : undefined}
      onSaved={handleSaved}
    >
      {({ steps }) => inner(steps)}
    </Editor>
  );
}
