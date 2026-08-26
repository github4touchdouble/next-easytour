# next-easytour — code-assistant integration reference

```yaml
name: next-easytour
version: 0.4.0
kind: react-component-library
language: typescript
module_type: esm
install: npm install next-easytour
peer_deps:
  react: ">=18.0.0"
  react-dom: ">=18.0.0"
import_path: next-easytour
server_import_path: next-easytour/server   # Node only — never from a client component
stylesheet_path: next-easytour/styles.css
main_exports:
  # Configured API — prefer these
  - defineTutorial    # one config object for a whole tour
  - TutorialProvider  # owns stepId, steps, completion, permission (no DOM)
  - TutorialStage     # renders the tour; no required props
  - TourTrigger       # start button, wired to the config (the tour's entry point)
  # Step stores
  - staticStore       # steps defined in code
  - httpStore         # JSON over HTTP, with save endpoint
  - localStore        # localStorage draft
  - clipboardStore    # save by copying JSON
  - draftOver         # local draft layered over a read-only source
  - normalizeSteps    # lift legacy 0.2/0.3 JSON into Step[]
  # Host features — how a tour drives the app
  - useTutorialFeature   # publish one host behaviour by name
  - useTutorialFeatures  # publish several at once
  - useFeatureList       # registered features as plain data
  # Headless primitives — for hand-wiring
  - Tutorial          # headless provider
  - Card              # step card
  - Arrow             # Bézier/straight arrow overlay
  - Spotlight         # dimmer with target cutouts
  - Circles           # annotated ellipses on target
  - Labels            # text annotations with animation
  - Tooltip           # lightweight popover (no nav controls)
  - TriggerButton     # tutorial start button (annoying/default modes)
  - Editor            # authoring wrapper
  - EditorHandles     # drag handles for card/arrow
  - EditorPanel       # Figma-style sidebar editor
  - EditorSeam        # yellow seam round the trigger while authoring
main_hooks:
  - useTour           # control the tour from anywhere in the provider
  - useTutorialFeature # register a host behaviour a step can invoke
  - useTutorial       # navigation API inside <Tutorial>
  - useTutorialTarget # register DOM element as named target
  - useTutorialSteps  # load a store into { steps, loading, error, reload }
  - useEditorPermission # resolve an EditorPermission into live state
  - useTutorialDone   # cookie-based completion tracking (0.3; prefer `completion`)
  - useEditorState    # editor state (active, unsavedCount, save)
  - useCardRect       # card bounding rect
server_exports:
  - createTutorialFileRoute  # { GET, POST, PUT } for a Next.js route handler
requires_client_component: true
requires_app_router: false
framework_agnostic: true
ssr_safe: true
editor_runs_in_production: false   # hard rule, no override exists
editor_ui_is_lazy_chunk: true      # handles/panel/seam load on demand, never in prod
css_prefix: eto-
css_var_prefix: --eto-
```

---

## Quick start — Next.js App Router

```tsx
// app/layout.tsx
import "next-easytour/styles.css";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
```

```tsx
// tour.ts — describe the tour once, at module scope
import { defineTutorial, targetPoint, type Step } from "next-easytour";

const steps: Step[] = [
  { id: "welcome", title: "Welcome!", body: "Let me show you around." },
  {
    id: "search",
    title: "Search",
    body: "Type here to find anything.",
    selector: "#search-input",
    highlight: true,
    annotations: { spotlight: true, arrow: { to: targetPoint(50, 50) } },
    waitFor: { type: "input", pattern: "\\S+" },
  },
];

export const tour = defineTutorial({
  id: "onboarding",
  steps,
  trigger: { text: "Take the tour", mode: "annoying" },
});
```

```tsx
// app/page.tsx
"use client";
import { TutorialProvider, TourTrigger, TutorialStage } from "next-easytour";
import { tour } from "./tour";

export default function Page() {
  return (
    <TutorialProvider config={tour}>
      <TourTrigger />
      <input id="search-input" placeholder="Search..." />
      <TutorialStage />
    </TutorialProvider>
  );
}
```

**The host does not need** `useState` for `stepId`, an `onStepChange`
handler, a fetch, a completion cookie, or a JSX gate around the overlays.
`<TutorialProvider>` owns all of it.

| Component | Role |
|---|---|
| `<TutorialProvider config>` | Owns state. Renders no DOM — wrap the page. |
| `<TourTrigger />` | Start button. Hides itself when open or unavailable. |
| `<TutorialStage />` | Draws the tour. Place anywhere inside the provider. |

## Quick start — Vite + React

Identical, minus `"use client"`.

```tsx
// src/main.tsx
import "next-easytour/styles.css";
```

```tsx
// src/App.tsx
import { defineTutorial, TutorialProvider, TourTrigger, TutorialStage } from "next-easytour";

const tour = defineTutorial({
  id: "onboarding",
  steps: [
    { id: "welcome", title: "Welcome!", body: "Let me show you around." },
    {
      id: "btn", title: "Click me", body: "Click the button to continue.",
      selector: "#my-button", highlight: true,
      annotations: { spotlight: true }, waitFor: { type: "click" },
    },
  ],
});

export default function App() {
  return (
    <TutorialProvider config={tour}>
      <TourTrigger />
      <button id="my-button">My button</button>
      <TutorialStage />
    </TutorialProvider>
  );
}
```

---

## Targeting

| Mode | When to use | Example |
|---|---|---|
| `selector: "#foo"` | Target exists in host markup | `{ selector: "#nav-search" }` |
| `useTutorialTarget("foo")` | Target is dynamic / conditional | `const ref = useTutorialTarget("row-1")` |

Hook targets take precedence when both are present.

## Step fields

| Field | Required | Description |
|---|---|---|
| `id` | **yes** | Unique string |
| `title` | no | Card heading |
| `body` | no | Card body text |
| `content` | no | JSX body (overrides `body`) |
| `selector` | no | CSS selector for target |
| `targets` | no | Hook-registered target IDs |
| `annotations.arrow` | no | `{ to: targetPoint(x, y), style?, label? }` |
| `annotations.spotlight` | no | Boolean — dim everything except target |
| `annotations.circles` | no | `Circle[]` — ellipses on target |
| `annotations.labels` | no | `TextLabel[]` — text annotations |
| `scrollIntoView` | no | `true` or `ScrollIntoViewOptions` |
| `actions` | no | Ordered side-effects on enter |
| `waitFor` | no | Block Next until condition met |
| `autoAdvance` | no | Auto-advance after N ms |
| `highlight` | no | `true` or `{ pulse, color, padding }` |
| `transition` | no | `{ enter: "fade" \| "fade-slide" \| "scale" \| "none" }` |
| `cardAnchor` | no | `viewportAnchor(x, y)` — card position |
| `meta` | no | Host-owned typed metadata |

## Actions (fire on step enter)

```tsx
actions: [
  { type: "scroll-into-view", behavior: "smooth" },
  { type: "wait", ms: 500 },
  { type: "click", selector: ".expand-btn" },
  { type: "highlight", pulse: true, duration: 2000 },
  { type: "add-class", selector: ".sidebar", className: "ring-2" },
  { type: "remove-class", selector: ".sidebar", className: "hidden" },
  { type: "dispatch", event: "tour:demo", detail: { mode: "dark" } },
  { type: "focus", selector: "#email-input" },
  { type: "feature", name: "chart.setMode", args: ["lines"] },   // ← host behaviour
]
```

## Host features — driving the app

**Use this instead of synthesising clicks whenever the tour needs to change
application state.** Clicks are brittle, and for a canvas or a virtualised
list they are impossible.

The host registers a behaviour by name, in the component that owns it:

```tsx
useTutorialFeature({
  name: "chart.setMode",              // required, unique, stable
  label: "Set chart mode",            // shown in the editor's menu
  description: "Bars or lines.",
  params: [{ name: "mode", type: "enum", options: ["bars", "lines"] }],
  run: (mode) => setMode(mode),       // may return a cleanup fn
  read: () => mode,                   // enables waitFor / equals
  snapshot: () => mode,               // taken when the tour opens
  restore: (m) => setMode(m as Mode), // put back when it closes
});
```

Steps then invoke it and stay serialisable:

```json
{ "actions": [{ "type": "feature", "name": "chart.setMode", "args": ["lines"] }],
  "waitFor": { "type": "feature", "name": "chart.hasSelection" } }
```

| Field | Effect if omitted |
|---|---|
| `run` | Not invocable — `{ type: "feature" }` actions warn |
| `read` | Not waitable — `waitFor: { type: "feature" }` warns |
| `snapshot` + `restore` | State is not restored when the tour closes |
| `params` | The editor cannot draw a form; args must be hand-written |

Rules that matter:

- The feature object **may be rebuilt every render.** Only `name` is
  identity, and the newest definition is always invoked — so `run` closes
  over current props and state with no memoising.
- Registering the **same name twice warns**; the later one wins.
- `run` returning a function makes it a **cleanup on step leave**.
- **State restores automatically** on close, via `snapshot`/`restore`.
  Disable with `features: { restoreOnClose: false }`.
- Features need `<TutorialProvider>`. A bare `<Tutorial>` has no registry
  and feature actions warn.
- `useTour().features` / `useFeatureList()` return `FeatureDescriptor[]` —
  use it to assert in a test that steps only name features that exist.

`FeatureParam.type` is one of `"string" | "number" | "boolean" | "enum" |
"string[]" | "json"`. `enum` and `boolean` become dropdowns in the editor,
`string[]` a comma-separated field.

## WaitFor conditions

```tsx
waitFor: { type: "click" }                                        // click on target
waitFor: { type: "click", selector: ".submit" }                   // click on element
waitFor: { type: "input", selector: "#name", pattern: "\\S+" }   // regex match
waitFor: { type: "event", name: "modal:closed" }                  // custom DOM event
waitFor: { type: "delay", ms: 3000 }                              // time delay
waitFor: { type: "visible", selector: ".result" }                 // element appears
waitFor: { type: "custom", predicate: () => count > 5 }           // poll function
waitFor: { type: "feature", name: "chart.hasSelection" }          // host feature is truthy
waitFor: { type: "feature", name: "chart.mode", equals: "lines" } // host feature equals a value
```

## Coordinates — DO NOT MIX

```ts
targetPoint(50, 50)     // { space: "target", x: 50, y: 50 }  — % of target rect
viewportAnchor(10, 20)  // { space: "viewport", x: 10, y: 20 } — % of viewport (fixed) or px (absolute)
```

## Custom card via render-prop

Via the stage — keeps every other overlay on:

```tsx
<TutorialStage card={(args) => <MyCard {...args} />} />
```

Or on `<Card>` directly, when hand-wiring:

```tsx
<Card>
  {({ step, index, total, isFirst, isLast, canAdvance, isWaiting, stableMinHeight, next, prev, close }) => (
    <div className="my-card" style={{ minHeight: stableMinHeight }}>
      <img src="/logo.svg" alt="Logo" />
      <h3>{step.title}</h3>
      <p>{step.body}</p>
      <footer>
        <button onClick={prev} disabled={isFirst}>Back</button>
        <span>{index + 1} / {total}</span>
        <button onClick={next} disabled={!canAdvance}>
          {isLast ? "Done" : "Next"}
        </button>
      </footer>
    </div>
  )}
</Card>
```

`stableMinHeight` is the max height across all steps — apply as `minHeight` for uniform card sizing with no jumping.

## Trigger + completion tracking

`<TourTrigger>` reads everything from the config — including a trigger
config saved from the editor — and hides itself when the tour is open or
unavailable.

```tsx
const tour = defineTutorial({
  id: "onboarding",
  steps,
  trigger: { text: "Take the tour", mode: "annoying", icon: true },
  completion: { markOn: "last-step" },   // cookie defaults to "onboarding-done"
});

<TourTrigger />                          // anywhere inside the provider
<TourTrigger text="Replay" startAt="intro" showWhileOpen />
```

`mode: "annoying"` pulses until the user completes the tour, then renders
calm. Completion is automatic:

| `completion.markOn` | Records completion when |
|---|---|
| `"last-step"` (default) | the last step is reached |
| `"finish"` | the tour is closed *after* reaching the last step |
| `"never"` | never — call `useTour().markDone()` yourself |
| `completion: false` | disables tracking entirely |

The 0.3 way — `<TriggerButton>` with hand-passed props plus
`useTutorialDone` — still works, but the editor cannot round-trip a saved
trigger config to it.

## Controlling the tour

```tsx
const { start, stop, restart, isOpen, done, markDone, resetDone,
        steps, loading, error, reload, available, editor } = useTour();
```

Works anywhere inside `<TutorialProvider>`, including outside the stage.

## Config reference — `defineTutorial`

| Field | Default | Description |
|---|---|---|
| `id` | **required** | Namespaces the completion cookie and warnings |
| `steps` | — | Steps in code. Ignored if `store` is set |
| `store` | `staticStore(steps)` | Where steps load from and save to |
| `theme` | — | `TutorialTheme` — sets `--eto-*` CSS variables |
| `card.positioning` | `"fixed"` | `"fixed"` pins to viewport, `"absolute"` scrolls with page |
| `card.anchor` | — | Default `viewportAnchor` for steps without their own |
| `transition` | — | `{ enter, exit, duration }` |
| `scrollIntoView` | — | Global auto-scroll default |
| `trigger` | — | `{ text, mode, icon }` defaults for `<TourTrigger>` |
| `completion` | `{ key: "<id>-done", markOn: "last-step" }` | Or `false` |
| `editor.permission` | *(nobody)* | See below |
| `editor.panel` / `.handles` | `true` | Authoring chrome |
| `editor.reloadAfterSave` | `true` | Re-read the store after saving |
| `minWidth` / `media` | — | Responsive gate via `matchMedia` |
| `enabled` | `true` | Hard off switch |
| `autoStart` | `false` | `true` or `{ once, delay }` |
| `classNames` | — | Per-slot classes for the built-in card and trigger |
| `features.restoreOnClose` | `true` | Put host state back when the tour closes |
| `entryPoint` | `"trigger"` | `"custom"` silences the unreachable-tour warning |

## Step stores

```tsx
staticStore(steps)                                  // in code, read-only
httpStore("/tour.json", { saveTo: "/api/tutorial" })// JSON file + save endpoint
localStore("draft", { fallback: steps })            // localStorage
clipboardStore()                                    // save → clipboard
draftOver(httpStore("/tour.json"), localStore("d")) // local draft over a source
```

`httpStore` cache-busts on load, normalises legacy JSON, and surfaces the
server's own error message on a failed save. A custom store is four
members:

```ts
interface TutorialStore<Meta> {
  readonly name: string;
  load?: (signal?: AbortSignal) => Promise<{ steps: Step<Meta>[]; trigger?: TriggerConfig; version: number }>;
  save?: (payload: { steps: Step<Meta>[]; trigger?: TriggerConfig; version: number }) => Promise<void>;
  readonly readonly: boolean;
}
```

Legacy JSON (0.2 flat `target` / `arrowTo` / `circles` / untagged
`cardAnchor`) is lifted by `normalizeSteps`, which stores are already
wired to. It is idempotent and moves unrecognised fields into `step.meta`
rather than dropping them — **do not write a host-side adapter.**

## Theming — three levels, composing

**1. Tokens.** 35 CSS custom properties. Set via config or CSS:

```tsx
defineTutorial({ id: "t", steps, theme: { accent: "#7c3aed", fontFamily: "Inter" } });
```
```css
:root { --eto-accent: #262262; --eto-card-radius: 1rem; }
.dark { --eto-accent: #60a5fa; --eto-surface: #18181b; }
```

| Group | Tokens |
|---|---|
| Colour | `accent`, `surface`, `fg`, `muted`, `mutedSoft`, `border`, `borderSoft`, `hoverBg`, `arrowColor`, `arrowOpacity` |
| Type | `fontFamily`, `fontSize`, `titleSize`, `titleWeight`, `lineHeight` |
| Card | `cardWidth`, `cardRadius`, `cardPadding`, `cardBackground`, `cardShadow`, `cardBackdropFilter`, `borderWidth` |
| Buttons | `buttonRadius`, `buttonPadding`, `buttonFontSize`, `primaryButtonBg`, `primaryButtonFg` |
| Overlays | `spotlightColor`, `spotlightPadding`, `spotlightRadius`, `highlightColor`, `seamColor` |

Each maps to `--eto-*` via `THEME_CSS_VARS`; `themeToCssVars(theme)` does
the conversion.

**2. Presets.** `theme: { preset: "minimal" }` — one of `default`,
`minimal`, `soft`, `glass`, `contrast`. Only a token bundle, so it can do
nothing your own tokens cannot; your tokens are applied on top.

**3. Slot classes.** For a design system that owns its styling:

```tsx
classNames: { card: "rounded-2xl shadow-xl", nextButton: "bg-indigo-600" }
```

Slots: `card`, `header`, `progress`, `closeButton`, `body`, `title`,
`copy`, `footer`, `prevButton`, `nextButton`, `trigger`, `spotlight`,
`tooltip`. The library class is kept and yours appended — this **adds to**
the default look. To replace it, use the render-prop.

## Editor

Authoring is on when **three** things are true: this is not a production
build, the user is allowed, and they have unlocked the editor.
`<TutorialStage>` renders the handles and panel itself — **do not gate
them in host JSX.**

> **The editor never runs in production.** `resolveAllow` returns false in
> a production build before considering anything else. `permission`,
> `canEdit`, `?edit=1`, and `unlock()` are all ignored there, and
> `createTutorialFileRoute` refuses writes ahead of `authorize`. Do not
> try to route around this — there is no flag. Author in development and
> deploy the JSON.
>
> The UI is not even shipped: `EditorHandles`, `EditorPanel` and
> `EditorSeam` sit behind a dynamic `import()` in `editor/chrome.tsx`,
> guarded by a foldable `process.env.NODE_ENV` check in
> `editor/useEditorChunk.ts`. **Never import those three statically** —
> one static import on the main path returns ~45 KB of authoring UI to
> every visitor's bundle. A test enforces this. `Editor` and
> `useEditorState` are exempt and stay in the main bundle.

```tsx
const tour = defineTutorial({
  id: "onboarding",
  store: httpStore("/tour.json", { saveTo: "/api/tutorial" }),
  editor: { permission: { allow: "dev-only" } },
});

// Reactive auth stays at the call site; the config stays a static module.
<TutorialProvider config={tour} canEdit={hasRole("admin")}>
  <TourTrigger />
  <TutorialStage />
</TutorialProvider>
```

| `editor.permission` | Meaning |
|---|---|
| *(unset)* / `false` / `"never"` | Nobody edits. **The default.** |
| `true` / `"always"` | Allowed, unlocked immediately |
| `"dev-only"` | Allowed outside production; unlock still required |
| `{ allow, requireUnlock, unlockParam, unlockKey, persistUnlock }` | Full rule |

Rule defaults: `requireUnlock: true`, `unlockParam: "edit"` (`?edit=1`),
`unlockKey: "mod+shift+e"`, `persistUnlock: "eto:editor-unlocked"`
(sessionStorage). Set any to `false` to disable that channel.

`allow` takes a **plain boolean** — the library never calls a host hook.
The 0.3 `canEdit={{ useCanEdit }}` shape still works but is deprecated: it
put a hook behind a prop, which the rules of hooks do not survive.

```tsx
const { allowed, unlocked, active, unlock, lock, toggle } = useTour().editor;
```

While unlocked, a yellow seam and a `next-easytour` badge are drawn round
the trigger button, so the author can see the mode is on and which button
belongs to the library. It is portaled, fixed, and `pointer-events: none`
— no DOM inline, no layout change. Restyle with `--eto-seam`,
`--eto-seam-fg`, `--eto-seam-radius`, `--eto-seam-z`. The seam tracks the
trigger, so it is on screen only while the tour is closed; once the tour
opens, the panel and handles are the mode indicator.

## Entry points

**A tour always has an entry point.** `<TourTrigger>` or `autoStart` —
without one, nothing can open the tour and the page looks entirely normal.
In development the provider warns when a tour is unreachable.

| `entryPoint` | Meaning |
|---|---|
| `"trigger"` (default) | A `<TourTrigger>` or `autoStart` is expected; warn if neither |
| `"custom"` | The host calls `useTour().start()` itself; stay quiet |

## Save endpoint (Next.js)

```ts
// app/api/tutorial/route.ts
import { createTutorialFileRoute } from "next-easytour/server";

export const { GET, POST } = createTutorialFileRoute({
  file: "public/tour.json",                 // required — no default to mistype
  authorize: async (req) => (await getSession(req))?.role === "admin",
  read: false,                              // GET returns 405 unless true
});
```

Validates and normalises the payload, refuses to overwrite a file with an
empty step list, writes atomically, and refuses paths outside the project
directory. **Every write is refused in a production build**, before
`authorize` is consulted — `authorize` narrows access within development,
it never grants it.

`next-easytour/server` is a **separate, Node-only entry point.** Importing
it from a client component fails to resolve `fs`.

## Lifecycle

```
start()      → onOpen, onStepEnter(a), actions, scrollIntoView, waitFor
next()       → onStepLeave(a), onStepEnter(b)
stop()       → onStepLeave(b), onClose, completion recorded
```

Callbacks go on `<TutorialStage>`: `onOpen`, `onClose`, `onStepEnter`,
`onStepLeave`, `canAdvance`. The tour closes itself if the media gate
stops matching, or if the open step disappears from the store.

## Does NOT do

- Ship analytics
- Support nested tours
- Authenticate anyone — `editor.permission.allow` takes a boolean *you* compute
- Require Next.js — works with any React 18+ setup
  (`next-easytour/server` is Next-shaped, but optional)

## Common mistakes

| Don't | Do |
|---|---|
| `useState` for `stepId` + `onStepChange` | `<TutorialProvider>` owns it; use `useTour()` |
| `{isAdmin && <EditorPanel />}` | `<TutorialStage>` gates chrome itself |
| Hand-written fetch + step adapter | `httpStore(url)` — it normalises legacy JSON |
| `onStepEnter` reading `step.meta` to drive app state | `useTutorialFeature` + `{ type: "feature" }` actions |
| Synthesising clicks to change app state | A feature — clicks break on canvas and virtual lists |
| A hand-rolled ref snapshotting pre-tour state | `snapshot` / `restore` on each feature |
| Rebuilding the card via render-prop just to restyle it | `theme` tokens, a `preset`, or `classNames` slots |
| Hand-written `/api/tutorial` route | `createTutorialFileRoute({ file, authorize })` |
| `typeof window !== "undefined" && innerWidth >= 768` in render | `minWidth: 768` on the config |
| `<TriggerButton>` with hand-passed props | `<TourTrigger />` |
| Comparing `step.id` to the last id to mark done | `completion.markOn` |
| Relying on `canEdit` defaulting to dev | `editor.permission: "dev-only"`, explicitly |
| Trying to enable the editor in production | Not possible. Author in dev, deploy the JSON |
| `import { EditorPanel } from "../editor/EditorPanel"` inside the library | Import from `editor/chrome` via `useEditorChunk`, or the chunk split breaks |
| A provider with no `<TourTrigger>` and no `autoStart` | Nothing can open the tour — add one, or `entryPoint: "custom"` |