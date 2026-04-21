# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.3] — 2026-04-21

### Added

- **Per-step card position (`cardAnchor`).** Each step can now carry an
  optional `cardAnchor: { x, y }` in viewport-percentage units, controlling
  where the tutorial card appears on screen for that step. When set, the
  card lands at the author's chosen spot on every display size — the anchor
  is a viewport fraction, so the card keeps its relative placement on a
  phone, a laptop, or an ultrawide without any absolute pixels.
- **Drag-to-place card in the authoring editor.** When `canEdit` is active,
  the card grows a grip handle in its header. Drag the handle to move the
  card anywhere on screen; **double-click** the handle to reset to the
  default bottom-centre position. Drags are staged in the unsaved count
  and persisted into `cardAnchor` on Save.
- **`--nto-surface` CSS variable.** Controls the surface colour the card
  sits on. Defaults: `#ffffff` in `:root`, `#18181b` in `.nto-dark`.
  Override per app to match your theme background:

  ```css
  :root { --nto-surface: var(--background); }
  .dark { --nto-surface: var(--background); }
  ```

### Fixed

- **Card background is now opaque.** Previously `--nto-bg-start` and
  `--nto-bg-end` mixed the accent colour with `transparent`, which made
  the card barely visible against bright app backgrounds. The card now
  mixes the accent with a solid surface colour (the new `--nto-surface`
  variable), producing a readable card in both light and dark modes with
  no host-side workaround. Border and shadow tokens are likewise mixed
  with solid neutrals (`#e5e7eb` / `#27272a`) rather than `transparent`.
- **Card position is no longer hard-pinned to the viewport bottom.** In
  `0.2.2` the stylesheet set `bottom: 1.5rem; left: 50%; transform:
  translateX(-50%)` directly on `.nto-card`. When an author had taken
  time to position the card somewhere specific for a step, that position
  was silently overridden on every render. Positioning is now applied
  inline by the component using the step's `cardAnchor` (or the default
  bottom-centre when none is set), so authored placements stick.
- **Removed `transform: translateY(6px)` from the card fade-in keyframe.**
  It was fighting the positioning transform on default-placed cards
  during the first 180 ms of mount, causing a brief horizontal snap on
  entry. The animation now fades opacity only.

### Migration

- No breaking API changes. Existing tours continue to render bottom-centre
  because `cardAnchor` is optional and absent in every saved JSON.
- Any app that relied on the previous semi-transparent card look can
  reinstate it by setting `--nto-surface: transparent` in their own
  stylesheet.
- If you had a host-side CSS override pinning `.nto-card` to the viewport
  (recommended as a workaround for the `0.2.1` positioning bug), remove
  it — the library now handles positioning itself.

## [0.2.2] — 2026-04-21

### Fixed

- **`.nto-card` now pins to the viewport.** The card previously had no
  positioning in the stylesheet, so on long pages it fell into document
  flow and ended up thousands of pixels below the fold instead of
  floating over the current scroll position. It is now `position: fixed;
  bottom: 1.5rem; left: 50%; transform: translateX(-50%);` with a
  `z-index` that sits above the library's arrow and circle SVG layers.
  Host apps can still override any of these properties via a more
  specific selector if they want a different layout.
- The card is also width-bounded now (`width: min(480px, calc(100vw - 2rem))`)
  so it renders correctly on narrow mobile viewports instead of stretching
  edge-to-edge.

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