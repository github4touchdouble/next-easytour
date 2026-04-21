# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0-alpha.0] — 2026-04-21

This is a **rewrite**, not a patch. The library shifts from a single
monolithic `<TutorialOverlay>` component with many props to a headless
provider plus composable overlay primitives. Branding, layout, and
integration all move into host code; the library owns only state,
coordinates, and pure rendering.

Breaking changes throughout — see `MIGRATING.md` for a line-by-line
guide. Alpha release on the `point-three` branch so early consumers
can trial the API before 0.3.0 ships stable.

### Added

- **Composable overlay primitives**: `<Tutorial>`, `<Card>`, `<Arrow>`,
  `<Spotlight>`, `<Circles>`. Compose only the parts you want.
- **Typed coordinate systems**: `TargetPoint` and `ViewportAnchor` are
  now nominal types with a `space` discriminator. The compiler
  catches every case of mixing target-relative and viewport-relative
  points.
- **`Step.id` is required** and is the sole navigation key. Reordering
  steps, deep-linking, and analytics all work without index churn.
- **`Step<Meta>` generic**. Host metadata lives under `step.meta` with
  a shape the host declares; library fields stay closed and typo-safe.
- **`useTutorialTarget(id)` hook**. Replaces `data-tutorial-id="…"`
  attribute lookup. Returns a callback ref; no more DOM string
  matching, no more cross-library collisions.
- **Lifecycle callbacks**: `onOpen`, `onClose`, `onStepEnter`,
  `onStepLeave`. Each receives the full step object.
- **`canAdvance` predicate** prop blocks forward navigation until a
  condition is met. Exposed via `status === "blocked"`.
- **`useTutorial()` hook** returns the full navigation API
  (`status`, `step`, `index`, `total`, `isFirst`, `isLast`,
  `canAdvance`, `next`, `prev`, `goto`, `close`) for custom card UI.
- **`<Editor>` + `<EditorHandles>`** — authoring mode split into a
  props-transforming wrapper and an opt-in drag-handles component.
  `useEditorState()` exposes read-only editor state for host-drawn
  UI (unsaved count, save status, save/revert methods).
- **`--eto-surface` CSS variable** — host theme background override
  for the card.
- **`--eto-*-z` CSS variables** for every overlay layer so hosts can
  tune z-index interaction with their own chrome.
- **Keyboard navigation** (Escape / Arrow keys) wired by default on
  `<Card>`. Opt out with `<Card disableKeyboard />`.
- **Accessibility**: `role="dialog"`, `aria-labelledby`,
  `aria-describedby`, `aria-label` on close button.
- **Vitest test suite**: 80 test cases across state, coords,
  geometry, provider lifecycle, and editor merging.

### Removed

- **`<TutorialOverlay>`** — replaced by `<Tutorial>` + `<Card>` +
  `<Arrow>` etc. See `MIGRATING.md`.
- **`data-tutorial-id`** attribute convention — use `useTutorialTarget`
  instead.
- **`onAction(action, index)`** string-dispatch callback — replaced by
  `onStepEnter(step, index)` with the full step object.
- **`isDark` prop** — use `.dark` class on an ancestor; the library
  reads CSS variables scoped under `.dark` automatically.
- **`logoSrc` / `logoWidth` / `logoHeight` / `headerLabel` /
  `ImageComponent` props** — use the render-prop form of `<Card>` for
  branded headers.
- **`debug` prop** (deprecated since 0.2.0) — removed. Use `canEdit`.
- **`useLocalStorageCanEdit`** — removed as a library-provided hook.
  Hosts can implement this in ~10 lines with `useSyncExternalStore`;
  leaving it out keeps the library dependency-light.
- **Automatic global `tutorial-highlight` class mutation** — replaced
  by `<Spotlight>` with SVG mask cutouts (no DOM class reach-in).
- **Index signature on `TutorialStep`** — custom fields go in
  `step.meta` now, typed by the host.

### Changed

- **CSS class prefix** is `eto-*` (was `nto-*`).
- **CSS variable prefix** is `--eto-*` (was `--nto-*`).
- **Package name stays `next-easytour`.** Not renamed.
- **Peer dependencies**: `lucide-react` is no longer required. The
  editor uses CSS-styled handles; no icon library dependency.
- **Default card layout** has no branding. Use render-prop mode for
  logo/header customisation.
- **Arrow origin** is the card's nearest edge to the target, not
  always the top-centre. Cards positioned anywhere on screen now
  route their arrows sensibly.
- **Card fade-in animation** is opacity-only (was translateY +
  opacity). Fixes a flicker when default-positioned cards mounted.

### Fixed

- Card no longer mixes backgrounds with `transparent`; renders opaque
  against any host surface.
- Card positioning is inline-style-driven; host CSS can no longer
  stomp the positioning with its own `position:` rules.
- Arrow disappears cleanly when the card and target overlap (no
  degenerate zero-length paths).
- Lifecycle callbacks are wrapped in try/catch so a throwing host
  callback doesn't brick the tour.
- Target rect observation uses `ResizeObserver` + scroll capture;
  catches every case the 0.2.x scroll-only listener missed.

### Migration

See `MIGRATING.md` in the repo root for a step-by-step guide from
0.2.x. The key changes for MuTopia:

1. Wrap content in `<Tutorial>`, compose the primitives you want.
2. Write a branded `<Card>` via render-prop (~30 lines) to replace
   the `logoSrc` prop.
3. Swap `data-tutorial-id="foo"` → `useTutorialTarget("foo")` on 10
   callsites (SignatureNav, MuTopiaHome).
4. Move step-specific effects into `onStepEnter` / `onStepLeave`.
5. Rename `--nto-accent` → `--eto-accent` in globals.css.
6. `step.meta.action` replaces the free-form `action: string` field.

## [0.2.3] — (not released)

Skipped. The positioning and opacity fixes intended for 0.2.3 are
folded into the 0.3.0 rewrite.

## [0.2.2] — 2026-04-21

### Fixed

- `.nto-card` now pins to the viewport (`position: fixed`) so it no
  longer falls into document flow on long pages.
- Card width is bounded so it renders correctly on mobile.

## [0.2.0] — 2026-04-21

### Added

- `canEdit` prop on `<TutorialOverlay>`, replacing `debug` as the
  canonical way to control access to the authoring editor.
- `useLocalStorageCanEdit(key?)` hook.

### Deprecated

- `debug` prop.

## [0.1.0] — 2026-04-21

### Added

- Initial release.
- `TutorialOverlay` component with step-based navigation, animated
  SVG Bézier arrows, target-element highlighting, annotated ellipses,
  visual authoring editor, CSS-variable theming.