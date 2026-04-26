# Changelog

## [0.3.0] — 2026-04-26

Complete rewrite. The library shifts from a monolithic `<TutorialOverlay>`
component to a headless provider plus composable overlay primitives.
Branding moves to host code via render-prop; the library owns state,
coordinates, animations, and rendering.

### Added

- **Composable overlay primitives.** `<Tutorial>`, `<Card>`, `<Arrow>`,
  `<Spotlight>`, `<Circles>`, `<Labels>`, `<Tooltip>`. Compose only the
  parts you need.

- **CSS-selector targeting.** Steps declare `selector: "#my-element"` to
  target any element without touching its source code. The library calls
  `querySelector` on step enter. Hook-based `useTutorialTarget` still
  works and takes precedence.

- **Step actions.** `step.actions` fires ordered side-effects on step
  enter: `scroll-into-view`, `click`, `focus`, `highlight`, `add-class`,
  `remove-class`, `set-attribute`, `dispatch`, `wait`.

- **WaitFor conditions.** `step.waitFor` blocks forward navigation until
  a condition is met: `click`, `input` (regex), `event` (custom DOM),
  `delay`, `visible` (element appears), `custom` (poll predicate).

- **Auto-scroll.** `step.scrollIntoView` scrolls the target into view.
  Accepts `true` or `ScrollIntoViewOptions`.

- **Auto-advance.** `step.autoAdvance` (ms) auto-advances after a delay.
  Fires after `waitFor` if both are set.

- **Highlight effects.** `step.highlight` renders a pulsing ring around
  the target. Accepts `true` or `{ pulse, color, padding, borderRadius }`.

- **Text labels with animation.** `annotations.labels` places text
  annotations relative to the target. Supports 5 visual variants
  (plain, callout, badge, tag, code) and frame-based text cycling with
  configurable speed, delay, and looping.

- **Straight and curved arrows.** `arrow.style.straight: true` draws a
  direct line. Curved arrows support bend, flip, dashed, and loop-end.
  Draw-on animation via `stroke-dashoffset`.

- **Render-prop card.** `<Card>{(args) => <MyCard />}</Card>` for full
  visual control. Render args include `step`, `index`, `total`,
  `isFirst`, `isLast`, `canAdvance`, `isWaiting`, `stableMinHeight`,
  `next`, `prev`, `close`.

- **Uniform card sizing.** Cards pre-measure all step content on mount.
  `stableMinHeight` is the tallest card's height — apply as `minHeight`
  for zero-jump navigation. Default card animation is `"none"` (instant
  content swap).

- **`<TriggerButton>`** — tutorial start button with two modes:
  `"annoying"` (red pulse with sweep, glow, strobe, rattle animations)
  and `"default"` (calm accent pill). Accepts `done` prop to
  auto-switch: annoying renders as default once the user has completed
  the tutorial. Works outside the `<Tutorial>` tree.

- **`useTutorialDone(cookieKey)`** — cookie-based completion tracking.
  Returns `{ done, markDone, reset }`. Persists across sessions via a
  1-year cookie.

- **`<Tutorial theme={...}>`** — programmatic theming via CSS custom
  properties. Properties: `accent`, `surface`, `fg`, `muted`,
  `mutedSoft`, `border`, `borderSoft`, `hoverBg`, `arrowColor`,
  `arrowOpacity`, `cardWidth`, `cardRadius`. Injected on `:root` via
  `useEffect`, cleaned up on unmount.

- **`<EditorPanel>`** — Figma-style sidebar for visual tutorial
  authoring. Step list with expand/collapse, per-step CRUD (add, remove,
  duplicate, reorder), overlay toggles (spotlight, highlight, arrow,
  auto-scroll), arrow shape presets (straight, gentle, curved, strong)
  with sliders for bend/stroke/head, text label editor with style
  dropdown and animation frames, trigger button config (text, mode, icon
  toggle), and "Reset all card positions" button.

- **Full step CRUD in Editor.** `addStep`, `removeStep`, `updateStep`,
  `moveStep`, `resetAllCardAnchors`. All mutations are local until Save.

- **`Editor` accepts `triggerConfig` prop** so the panel shows the host's
  actual button text and mode as defaults.

- **`SaveHandler` receives `triggerConfig`.** Second argument
  `options?: { triggerConfig?: TriggerConfig }` carries the editor's
  trigger button configuration alongside the step array.

- **Animation engine.** `useFrameSequence` (state-machine frame cycling),
  `useEnterAnimation` (CSS class on step change), `useArrowDraw` (SVG
  draw-on). Single timer per state, no nested setTimeout, trigger counter
  for re-triggering on same step.

- **`OverlayPortal`** — synchronous portal to `document.body`. No mount
  delay, works with SSR guard.

- **`TutorialApi.steps`** — all steps exposed on the API so overlay
  components can iterate for pre-measurement.

- **Typed coordinate systems.** `TargetPoint` (% of target rect) and
  `ViewportAnchor` (% of viewport or px in absolute mode). Constructors:
  `targetPoint(x, y)` and `viewportAnchor(x, y)`.

- **`Step<Meta>` generic.** Host metadata on `step.meta` with a shape
  the host declares.

- **Keyboard navigation.** Escape closes, Arrow keys navigate. Opt out
  with `<Card disableKeyboard />`. Escape blurs the active element first
  to prevent focus leaks.

- **Accessibility.** `role="dialog"`, `aria-labelledby`,
  `aria-describedby`, `aria-label` on close button.

- **Dark mode.** Add `.dark` to an ancestor — CSS variables handle the
  rest. Full set of dark-mode token overrides built in.

- **Vitest test suite.** 97 tests across state, coords, geometry,
  provider lifecycle, editor merging, and card positioning.

### Removed

- **`<TutorialOverlay>`** — replaced by composable primitives.
- **`<Card variant="branded">`** — removed. Use render-prop for custom
  card styling. The library ships no branding.
- **`CardVariant`, `BrandedCardProps`** types — removed.
- **`data-tutorial-id`** attribute convention — use `useTutorialTarget`.
- **`onAction(action, index)`** callback — use `onStepEnter(step, index)`.
- **`isDark` prop** — use `.dark` ancestor class.
- **`logoSrc` / `logoWidth` / `logoHeight` / `headerLabel` /
  `ImageComponent` props** — use render-prop card.
- **`debug` prop** — use `canEdit`.
- **`useLocalStorageCanEdit`** — implement in host code.
- **`lucide-react` peer dependency** — no icon library required.

### Changed

- **CSS class prefix** `eto-*` (was `nto-*`).
- **CSS variable prefix** `--eto-*` (was `--nto-*`).
- **Default card animation** is `"none"` (instant swap, no jumping).
- **Arrow origin** is the card's nearest edge to the target, not always
  top-centre.
- **Card positioning** is inline-style-driven — host CSS cannot stomp it.
- **Spotlight cutouts** transition smoothly between steps (300ms ease).
- **Frame transitions** are opacity-only — no transform changes, no
  label jumping.

### Fixed

- Card renders opaque against any host surface (no `transparent` mixing).
- Arrow disappears cleanly when card and target overlap.
- Lifecycle callbacks wrapped in try/catch — throwing host code doesn't
  brick the tour.
- Target rect observation via `ResizeObserver` + scroll capture.
- Editor handles visible against all backgrounds (solid fills, borders).
- `mergeOverrides` constructs arrow annotations from nothing when an
  arrow-tip override is applied to a step without an existing arrow.

### Migration from 0.2.x

1. Replace `<TutorialOverlay>` with `<Tutorial>` + `<Card>` + `<Arrow>`.
2. Write a custom `<Card>` via render-prop for branded headers.
3. Swap `data-tutorial-id="foo"` → `useTutorialTarget("foo")`.
4. Move step effects into `onStepEnter` / `onStepLeave`.
5. Rename `--nto-accent` → `--eto-accent` in CSS.
6. `step.meta.action` replaces the free-form `action: string` field.

## [0.2.3] — (not released)

Skipped. Fixes folded into the 0.3.0 rewrite.

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