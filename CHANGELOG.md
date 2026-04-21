# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] — 2026-04-21

### Added

- **`canEdit` prop** on `<TutorialOverlay>`, replacing `debug` as the
  canonical way to control access to the authoring editor. Accepts:
  - `boolean` — explicit on/off.
  - `"auto"` (default when omitted) — on in development, off in production.
  - `() => boolean` — a synchronous predicate.
  - `{ useCanEdit: () => boolean }` — a user-supplied React hook, the
    correct shape when the check itself calls other hooks (auth context,
    feature flags, `useSyncExternalStore`, etc.).
- **`useLocalStorageCanEdit(key?)`** — a ready-made hook for toggling
  authoring mode via a `localStorage` key. Safe on the server; re-renders
  automatically when the key changes in another tab.
- **`CanEdit` type** exported from the public API.

### Changed

- The editor is now **on by default in development** and **off in
  production**, unless `canEdit` is explicitly set. Existing `debug`
  users see no behavioural change.

### Deprecated

- **`debug` prop.** Still honoured when supplied (and takes precedence
  over `canEdit` to preserve behaviour), but a development-only warning
  is logged and the prop will be removed in `0.3.0`. Migration: rename
  `debug={x}` to `canEdit={x}`.

## [0.1.0] — 2026-04-21

### Added

- Initial release.
- `TutorialOverlay` component with step-based navigation, animated SVG Bézier
  arrows, target-element highlighting, annotated ellipses, and controlled
  `step` / `onStepChange` API.
- Visual authoring editor (`debug={true}`) with drag handles for the arrow
  tip and circle shapes, per-step style sliders, and a Save callback.
- CSS-variable theming with optional dark-mode scope.
- Geometry helpers exported for custom arrow rendering and tests.
- TypeScript declarations, ESM-only distribution, `sideEffects` declared.
- JSON Schema for `TutorialStep[]` at `tutorial.schema.json`.
- `LLMS.md` / `AGENTS.md` reference for code assistants.
- Next.js App Router example under `examples/nextjs-app/`.
- Vite + React example under `examples/vite-react/`.