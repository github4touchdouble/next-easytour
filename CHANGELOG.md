# Changelog

## [0.4.0] — 2026-08-26

Configuration rework. A tour's settings were spread across four
components that did not know about each other; they now live in one
config object, and a provider owns the state that hosts were hand-rolling.

**Nothing in 0.3 was removed.** Every 0.3 export still works with the same
behaviour, so upgrading is a version bump. The new API sits alongside it.

### Added

- **`defineTutorial(config)`.** One object for steps, theme, card
  placement, trigger, completion, editor permissions, media gating, and
  auto-start. Validates in development and fills in defaults.

- **`<TutorialProvider config>`.** Headless. Owns `stepId`, loads steps,
  tracks completion, resolves edit permission. Wrap the page in it and
  the host no longer needs `useState` + `onStepChange`.

- **`<TutorialStage />`.** Renders the tour — overlays, editor wrapper,
  authoring chrome — with no required props. Returns null unless the tour
  is both available and open, replacing the availability checks hosts
  wrote in JSX. Brand the card with one prop:
  `<TutorialStage card={(args) => <MyCard {...args} />} />`.

- **`<TourTrigger />`.** The start button, wired to the config: reads
  text/mode/icon (including a config saved from the editor), passes
  completion state, hides itself when the tour is open or unavailable.

- **`useTour()`.** `start`, `stop`, `restart`, `isOpen`, `done`,
  `markDone`, `steps`, `reload`, `editor` — from anywhere inside the
  provider, including outside the stage.

- **The editor cannot run in production.** Not a default — a rule with no
  override. `resolveAllow` returns false in a production build before it
  looks at anything else, so neither `permission: { allow: true }` nor a
  truthy `canEdit` from host auth nor `?edit=1` can reopen it; a host that
  asks anyway gets a one-time console warning explaining the denial.
  `createTutorialFileRoute` refuses every write in production too, ahead
  of `authorize`, so a save endpoint cannot outlive the editor it serves.
  Author tutorials in development and deploy the resulting JSON.

- **Host features — a generic API for tours that drive the app.** A tour
  could point at things and click them, but not *operate* the
  application: selecting rows, switching a chart's mode, expanding a
  panel. Doing that meant an `onStepEnter` handler that read `step.meta`
  and dispatched by hand — the point where tours stop being data and the
  editor stops being able to author them.

  A component now publishes its behaviour by name:

  ```tsx
  useTutorialFeature({
    name: "chart.setMode",
    label: "Set chart mode",
    params: [{ name: "mode", type: "enum", options: ["bars", "lines"] }],
    run: (mode) => setMode(mode),      // may return a cleanup
    read: () => mode,                  // for waitFor
    snapshot: () => mode,              // captured when the tour opens
    restore: (m) => setMode(m),        // put back when it closes
  });
  ```

  and a step calls it:

  ```json
  { "actions": [{ "type": "feature", "name": "chart.setMode", "args": ["lines"] }],
    "waitFor": { "type": "feature", "name": "chart.hasSelection" } }
  ```

  The step stays JSON, so it round-trips through a file and the editor can
  author it. Related pieces:

  - `useTutorialFeature` / `useTutorialFeatures` register from the
    component that owns the state. The definition may be rebuilt every
    render — only `name` is identity, and the newest definition is always
    the one invoked, so `run` closes over current props without memoising.
  - `{ type: "feature" }` as a `StepAction` and as a `WaitCondition`. The
    wait polls `read()`, matching `equals` when given and truthiness
    otherwise; it is the serialisable sibling of `custom`.
  - A `run` that returns a function has it treated as cleanup on step
    leave, for a feature that opens something that should close again.
  - **Automatic restore.** Every feature's `snapshot()` is taken when the
    tour opens and handed back to `restore()` when it closes, so a tour
    cannot leave the app filtered and re-moded behind it. Disable with
    `features: { restoreOnClose: false }`. One feature throwing does not
    strand the others.
  - `useTour().features` and `useFeatureList()` expose the registry as
    plain data, which is what lets the editor offer a menu — and lets a
    host assert in a test that its steps only name features that exist.
  - An unknown feature name warns with the list of names that *do* exist,
    sorted, which is what you actually need when hunting a typo.

- **The editor can wire features without JSON.** A new "App features"
  section in the panel lists everything the app has registered and draws a
  form per feature from its declared `params` — enum fields become
  dropdowns, `string[]` takes a comma-separated list. A step that names a
  feature this build no longer registers says so instead of rendering an
  empty row.

- **Theming, at three levels.** Changing the look no longer means dropping
  to the render-prop and rebuilding the card.

  - **Tokens.** `TutorialTheme` grew from 12 to 35: typography
    (`fontFamily`, `fontSize`, `titleSize`, `titleWeight`, `lineHeight`),
    card surface (`cardPadding`, `cardBackground`, `cardShadow`,
    `cardBackdropFilter`, `borderWidth`), buttons (`buttonRadius`,
    `buttonPadding`, `buttonFontSize`, `primaryButtonBg`,
    `primaryButtonFg`), and overlays (`spotlightColor`,
    `spotlightPadding`, `spotlightRadius`, `highlightColor`,
    `seamColor`). The built-in components read all of them, including
    `<Spotlight>`, which resolves the numeric ones itself because SVG
    geometry cannot come from CSS.
  - **Presets.** `theme: { preset: "minimal" | "soft" | "glass" |
    "contrast" }` changes the whole feel in a word. A preset is only a
    bundle of tokens — there is no preset-specific CSS, so it can never do
    something your own tokens could not, and your tokens are applied on
    top of it.
  - **Slot classes.** `classNames: { card, title, nextButton, … }` puts
    your classes on individual parts of the built-in card and trigger, for
    a design system that owns its styling. The library's own class is kept
    and yours appended.

- **The editor UI is a lazy chunk.** The drag handles, sidebar panel, and
  seam — about 45 KB, roughly 1,100 lines of interface no end user can
  reach — moved behind a dynamic `import()` guarded by a foldable
  `process.env.NODE_ENV` comparison. A production build emits the chunk
  but never references it: it is absent from the build manifest and from
  the served HTML, so no visitor downloads it. In development it is
  fetched as soon as a user is *allowed* to edit rather than when they
  unlock, so unlocking stays instant.

  `Editor` and `useEditorState` stay in the main bundle deliberately:
  `Editor` merges pending edits and passes steps through, so a host that
  wraps its tour in it needs it to work in production, and a hook cannot
  be loaded asynchronously. `<EditorHandles>`, `<EditorPanel>` and
  `<EditorSeam>` are still importable from the package root with the same
  props — the root now exports chunk-safe wrappers that load the
  implementation on demand and render null in production.

  A test asserts the invariant the split rests on: nothing outside
  `editor/chrome.tsx` may import those three statically, and the dynamic
  import must stay in the loader behind the foldable guard.

- **Editor seam.** While the editor is unlocked, a yellow seam with a
  `next-easytour` badge is drawn around the tour's trigger button, so an
  author can see which button on the page belongs to the library and that
  editing is live. Portaled and `position: fixed`, tracking the button's
  rect each frame — it adds no DOM inline, changes no layout, and never
  intercepts a click. `<TriggerButton>` now forwards its ref, which is how
  the seam finds the button without wrapping it. Restyle with
  `--eto-seam`, `--eto-seam-fg`, `--eto-seam-radius`, `--eto-seam-z`.

- **Entry points are a stated rule.** A tour nothing can open is invisibly
  broken — the page just looks normal. `entryPoint` defaults to
  `"trigger"`, and in development the provider warns when neither a
  `<TourTrigger>` nor `autoStart` is present. Set `entryPoint: "custom"`
  when you call `start()` yourself.

- **Editor permission model.** `editor.permission` takes
  `{ allow, requireUnlock, unlockParam, unlockKey, persistUnlock }` or a
  shorthand (`true`, `"dev-only"`, `"never"`). `allow` is a plain
  boolean, so the library never calls host hooks. An allowed user unlocks
  with `?edit=1` or Ctrl/Cmd+Shift+E; the unlock persists per session.
  `<TutorialProvider canEdit>` overrides `allow`, which lets a static
  module-scope config carry reactive auth.

- **Step stores.** `staticStore`, `httpStore`, `localStore`,
  `clipboardStore`, and `draftOver` implement a four-member
  `TutorialStore` interface. `httpStore` cache-busts on load and surfaces
  the server's own error message on a failed save. `useTutorialSteps`
  exposes any store as `{ steps, trigger, loading, error, reload }` and
  ignores results from a superseded load.

- **`normalizeStep` / `normalizeSteps` / `normalizeTutorial`.** Lift
  legacy 0.2 flat fields (`target`, `arrowTo`, `arrowStyle`, `circles`,
  untagged `cardAnchor`) into the current shape. Idempotent, so a step
  round-trips through save → load unchanged, and lossless, because
  unrecognised fields move into `step.meta` instead of being dropped.

- **`next-easytour/server`.** `createTutorialFileRoute({ file, authorize })`
  returns `{ GET, POST, PUT }` for a Next.js route handler. Validates the
  payload, refuses to overwrite a file with an empty step list, writes
  atomically, refuses paths outside the project directory, and denies
  writes outside development unless given an `authorize` function. Node
  only — a separate entry point, so nothing filesystem-shaped can reach a
  client bundle.

- **Responsive gating.** `minWidth` / `media` on the config, evaluated
  through `matchMedia` in `useSyncExternalStore`. Replaces the
  `typeof window !== "undefined" && window.innerWidth >= 768` check in
  render, which hydrates wrong and never updates on resize. The tour also
  closes itself if the query stops matching mid-run.

- **Automatic completion.** `completion.markOn` is `"last-step"` (default)
  or `"finish"`, which withholds completion until the tour is closed from
  the last step. The cookie name defaults to `"<id>-done"`.

- **`autoStart`.** Opens the tour on mount, `once` by default so it skips
  users who have already finished.

### Fixed

- **`canEdit={{ useCanEdit }}` violated the rules of hooks.** The hook was
  called inside a ternary, so a host that changed the shape of `canEdit`
  between renders changed the hook count and crashed React. The call is
  unconditional now, and the shape warns in development. Prefer
  `editor.permission`, which takes a plain boolean.

- **The trigger config round-trip was broken.** The editor could save
  `triggerConfig`, but `<TriggerButton>` was rendered with hand-passed
  props and never read it back, so saving a change to the button's label
  or mode had no visible effect. `<TourTrigger>` reads the saved config.

- **Closing a tour outside `<Tutorial>` skipped completion.** `onClose`
  only fires for closes `<Tutorial>` initiates, so a host-driven close
  never recorded completion. `<TutorialProvider>` owns `stepId` and does
  the bookkeeping on every close path.

- **`localStore` threw a bare `TypeError` where `localStorage` is absent**
  (SSR, Safari private mode, restrictive storage policies). Loads now fall
  back, and saves reject with a message the editor can show.

- **A tour could sit open on a deleted step.** The provider closes the
  tour when the open `stepId` is missing after a reload or an editor
  delete.

### Deprecated

Still exported, still working, but superseded:

| 0.3 | 0.4 |
|---|---|
| `canEdit` on `<Editor>` | `editor.permission` on the config |
| `CanEdit` type | `EditorPermission` |
| hand-written `onSave` / `onSaved` | a `TutorialStore` |
| `useTutorialDone("key")` + manual `markDone` | `completion` on the config |
| `<TriggerButton>` with hand-passed props | `<TourTrigger />` |
| host-side legacy step adapters | `normalizeSteps` |

### Migrating

The 0.3 API is unchanged, so migrate a tour when convenient. The shape of
the change:

```tsx
// 0.3 — state, fetching, and the admin gate all in the host
const [stepId, setStepId] = useState<string | null>(null);
const { done, markDone } = useTutorialDone("my_tour_done");
useEffect(() => { fetch("/tour.json?t=" + Date.now())...; }, []);

{isAdmin && <EditorPanel />}
<Editor steps={steps} canEdit={isAdmin} onSave={...}>
  {({ steps }) => (
    <Tutorial steps={steps} stepId={stepId} onStepChange={setStepId}>…</Tutorial>
  )}
</Editor>
```

```tsx
// 0.4
const tour = defineTutorial({
  id: "my-tour",
  store: httpStore("/tour.json", { saveTo: "/api/tutorial" }),
  editor: { permission: { allow: true } },
});

<TutorialProvider config={tour} canEdit={isAdmin}>
  <TourTrigger />
  <TutorialStage card={(args) => <MyCard {...args} />} />
</TutorialProvider>
```

### Internal

- The browser build emits code-split chunks, so the editor's dynamic
  import survives into `dist` as a real chunk boundary rather than being
  inlined back into `dist/index.js`.
- The stylesheet is copied by tsup's `onSuccess` rather than a shell step
  after it. `clean` wipes `dist` at the start of a build, and a consumer
  running a dev server against a linked checkout would fail to resolve
  `next-easytour/styles.css` for as long as the gap lasted.
- `@types/node` added as a devDependency for the server entry point. It
  does not reach consumers — the emitted `.d.ts` exposes only DOM and
  React types.
- The build moved to `tsup.config.ts` to give the browser and Node entry
  points different platforms.

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