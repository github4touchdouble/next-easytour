"use client";

/**
 * @module editor/lazyChrome
 *
 * Chunk-safe stand-ins for the authoring UI, used by the package root.
 *
 * `<EditorPanel>` and friends have been importable from `next-easytour`
 * since 0.3, and hand-wired hosts render them directly. Re-exporting the
 * real components from the root would defeat the chunk split, though: a
 * static re-export makes them reachable from the main entry, so the
 * bundler keeps them in the eagerly-loaded output even when nothing
 * renders them.
 *
 * These wrappers keep the same import path and the same props, and pull
 * the implementation in on demand. In a production build they render null
 * without loading anything, which matches the rule that the editor does
 * not run there.
 */

import * as React from "react";
import { useEditorChunk } from "./useEditorChunk";
import type { EditorSeamProps } from "./EditorSeam";

/** Drag handles for the card and arrow. Renders nothing until unlocked. */
export function EditorHandles(): React.ReactElement | null {
  const chunk = useEditorChunk(true);
  if (!chunk) return null;
  return <chunk.EditorHandles />;
}

/** The sidebar step editor. Renders nothing until unlocked. */
export function EditorPanel(): React.ReactElement | null {
  const chunk = useEditorChunk(true);
  if (!chunk) return null;
  return <chunk.EditorPanel />;
}

/** The seam drawn around a tour's entry point while authoring. */
export function EditorSeam(props: EditorSeamProps): React.ReactElement | null {
  const chunk = useEditorChunk(true);
  if (!chunk) return null;
  return <chunk.EditorSeam {...props} />;
}
