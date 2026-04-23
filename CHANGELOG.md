# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0-alpha.1] — 2026-04-23

Visibility and authoring fixes on the 0.3.0 alpha series. No breaking
surface changes for consumers who only use `<Tutorial>` + `<Card>` +
`<Arrow>`; additive API for authoring-heavy consumers.

### Fixed

- **Editor handles were invisible against light backgrounds.** The
  `.eto-editor-card-handle` was a 60 %-opacity accent-tinted blob that
  vanished on near-white surfaces. Both handles now ship as solid
  filled controls with visible borders, a grip-dots SVG icon on the
  card handle, and a larger hit target (28×28 card, 18×18 tip).
- **`mergeOverrides` silently dropped arrow-tip overrides on steps
  without an existing arrow.** The merge guard `if (arrowTipOverride
  && annotations.arrow)` prevented authors from adding a tip to a
  target-only step. Now the merge constructs a minimal arrow when
  needed (`annotations.arrow = { to: override }`), so drag-to-create
  works through the editor's normal override channel.
- **Targetless steps lost their connection to the UI.** A step with no
  `cardAnchor` and no `targets` previously rendered bottom-centre with
  no visual link to anything. The default for targetless steps is now
  centred in the viewport so the card reads as a modal introduction
  rather than a detached footer note. Steps that *do* have a target
  keep the bottom-centre default, since the arrow supplies the
  connection.

### Added

- **`<Card variant="branded">`** — an opt-in default card with a
  gradient accent header, logo slot, progress dots, and a primary
  accent Next button. Matches the visual weight of 0.2.x's built-in
  card without forcing every host to write their own render-prop
  from scratch.

  ```tsx
  <Card
    variant="branded"
    logo="/my-logo.svg"
    logoAlt="My product"
    labels={{ back: "Back", next: "Next", done: "Finish", close: "Close" }}
  />
  ```

- **`useEditorState()` exposes mutators when the editor is active.**
  Authoring UIs can now call `setCardAnchor`, `setArrowTip`,
  `setArrow` (new — seeds both the target and the tip on a step
  with no arrow), and `setCircles` directly, without having to write
  to base steps behind the editor's back. Mutators are `undefined`
  when the editor is inactive, so read-only callers keep type-safety.

  ```tsx
  const editor = useEditorState();
  if (editor?.active) {
    editor.setArrow(stepId, { targets: ["umap-plot"], to: { space: "target", x: 50, y: 50 } });
  }
  ```

- **Drag-to-create arrow handle.** When a step has a registered target
  but no arrow annotation, `<EditorHandles>` now renders a small
  "create arrow" handle pinned to the card's right edge. Dragging it
  into the viewport seeds the arrow with an initial `TargetPoint`; the
  existing `<ArrowTipHandle>` takes over once the drag starts.
  Visually distinct from the tip handle (dashed border) so authors
  can tell creation from re-aim.

- **CSS tokens for handle styling.** `--eto-handle-bg`,
  `--eto-handle-border`, `--eto-handle-size`, `--eto-handle-radius`,
  `--eto-tip-size`. Hosts that want different handle visuals can
  override these without wholesale class overrides.

- **`CardVariant` type, `BrandedCardProps` type** exported for
  consumers building on top of the branded variant.

### Changed

- **Default `cardAnchor` for targetless steps** is now viewport-centred
  (`{ space: "viewport", x: 50, y: 50 }` with transform centring).
  Steps with targets still default bottom-centre.
- **Keyboard `Escape` close** now blurs the currently-focused element
  first, so focus doesn't silently leak back to a tour-originated button
  after the tour closes.

### Deprecated

- The internal-only `EditorInternalApi` export is kept for
  `<EditorHandles>` but is marked `@deprecated` in JSDoc for external
  consumers. Use `useEditorState()` which now exposes the same
  mutators when `active`.

### Migration

Existing 0.3.0-alpha.0 consumers:

- If you reach into the library's styles to override
  `.eto-editor-card-handle`, revisit — the default is now solid and
  grip-iconed, so your override may be redundant.
- If you previously used `useEditorState()` and got back just
  `{ active, unsavedCount, saveStatus, save, revert }`, the mutators
  are now present when `active === true`. Purely additive; no code
  changes needed.
- `<Card>` without `children` still renders the no-branding default.
  To get the new branded layout explicitly, pass `variant="branded"`.

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