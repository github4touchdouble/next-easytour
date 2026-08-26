"use client";

/**
 * @module editor/chrome
 *
 * The editor's chunk boundary.
 *
 * The authoring *UI* — drag handles, sidebar panel, seam — is reachable
 * only through this module, and this module is reached only through a
 * dynamic `import()` inside a branch that folds away in a production
 * build. Roughly 1,100 lines of interface no end user can reach.
 *
 * `Editor` and `useEditorState` are deliberately **not** here. `Editor`
 * is the wrapper that merges pending edits into the step list and passes
 * them through; a 0.3-style host renders it unconditionally and relies on
 * it to render the tour at all, so it has to work in production, where it
 * is a pass-through. `useEditorState` is a hook, and a hook cannot be
 * loaded asynchronously.
 *
 * Nothing on the main render path may import these three statically. One
 * static import anywhere puts all of it back in the bundle every visitor
 * downloads, which is the only thing this file exists to prevent — see
 * the note in `useEditorChunk`.
 */

export { EditorHandles } from "./EditorHandles";
export { EditorPanel } from "./EditorPanel";
export { EditorSeam } from "./EditorSeam";
export type { EditorSeamProps } from "./EditorSeam";
