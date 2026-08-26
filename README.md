# next-easytour

**Interactive tutorial overlays for React and Next.js.**

Build animated, step-by-step product tours that interact with your components — without modifying their source code.

```bash
npm install next-easytour
```

## Quick start

Describe the tour once, then render it.

```tsx
// app/layout.tsx (Next.js) or src/main.tsx (Vite)
import "next-easytour/styles.css";
```

```tsx
// tour.ts
import { defineTutorial, targetPoint, type Step } from "next-easytour";

const steps: Step[] = [
  { id: "welcome", title: "Welcome!", body: "Let me show you around.", autoAdvance: 3000 },
  {
    id: "search",
    title: "Search anything",
    body: "Type here to find what you need.",
    selector: "#search-input",
    scrollIntoView: true,
    highlight: true,
    annotations: { spotlight: true, arrow: { to: targetPoint(50, 50) } },
    waitFor: { type: "input", pattern: "\\S+" },
  },
  { id: "done", title: "You're all set!", body: "Explore at your own pace." },
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

That's the whole integration. No `useState`, no `onStepChange`, no manual
completion tracking, and no gating the overlays in JSX — `<TutorialProvider>`
owns that state, and `<TourTrigger>` and `<TutorialStage>` read it.

### The three pieces

| Component | Role |
|---|---|
| `<TutorialProvider config>` | Owns state, loads steps, tracks completion and edit permission. Renders no DOM — wrap the page. |
| `<TourTrigger />` | The start button. Reads its text and mode from the config, hides itself while the tour is open or unavailable. |
| `<TutorialStage />` | Draws the tour: spotlight, arrow, circles, labels, card, and authoring chrome. Place it anywhere inside the provider. |

**A tour always has an entry point.** Either a `<TourTrigger>` or
`autoStart` — otherwise nothing can open it and the page just looks normal.
The library warns in development when a tour is unreachable; set
`entryPoint: "custom"` if you call `start()` yourself.

Control the tour from anywhere inside the provider with `useTour()`:

```tsx
const { start, stop, restart, isOpen, done, steps } = useTour();
```

## Loading steps from a file

Point the config at a store instead of an array. The store handles fetching,
cache-busting, and normalising older file formats.

```tsx
import { defineTutorial, httpStore } from "next-easytour";

export const tour = defineTutorial({
  id: "onboarding",
  store: httpStore("/tour.json", { saveTo: "/api/tutorial" }),
});
```

| Store | Use for |
|---|---|
| `staticStore(steps)` | Steps defined in code. The default when you pass `steps`. |
| `httpStore(url, { saveTo })` | A JSON file on disk or a CDN, saved back through an endpoint. |
| `localStore(key)` | Drafting a tour with no backend. Survives reloads. |
| `clipboardStore()` | Save by copying JSON to the clipboard. |
| `draftOver(source, draft)` | Read from `source` until a local `draft` exists, then prefer the draft. |

A store is a small interface — `{ name, load?, save?, readonly }` — so a
custom backend is a few lines.

## Making the tour drive your app

Pointing at things only goes so far. To *operate* the app — select rows,
switch a mode, open a panel — register the behaviour by name in the component
that owns it:

```tsx
useTutorialFeature({
  name: "chart.setMode",
  label: "Set chart mode",
  params: [{ name: "mode", type: "enum", options: ["bars", "lines"] }],
  run: (mode) => setMode(mode),   // may return a cleanup, run on step leave
  read: () => mode,               // lets steps wait on it
  snapshot: () => mode,           // taken when the tour opens
  restore: (m) => setMode(m),     // put back when it closes
});
```

Steps then use it by name, and stay plain JSON:

```ts
{
  id: "modes",
  title: "Two ways to read this",
  actions: [{ type: "feature", name: "chart.setMode", args: ["lines"] }],
  waitFor: { type: "feature", name: "chart.hasSelection" },
}
```

Because the step is data, it survives a round trip through a file **and the
editor can author it** — the panel lists every registered feature and builds a
form from its `params`, so a tour that drives your app can be assembled by
clicking rather than by hand-writing JSON.

Three things fall out of this:

- **`run` can return a cleanup**, so a feature that opens something closes it
  again when the step is left.
- **State is restored automatically.** Every `snapshot()` is taken when the
  tour opens and handed to `restore()` when it closes, so a tour never leaves
  the app filtered and re-moded behind it. Turn it off with
  `features: { restoreOnClose: false }`.
- **Typos are caught.** An unknown feature name warns with the sorted list of
  names that do exist. `useTour().features` gives you the registry as plain
  data, so a test can assert your steps only name features you actually ship.

## Changing the look

Three levels, in increasing specificity. They compose.

**Tokens** — 35 CSS custom properties covering colour, typography, card
surface, buttons, and overlays:

```tsx
defineTutorial({
  id: "t", steps,
  theme: { accent: "#7c3aed", fontFamily: "Inter, sans-serif", cardRadius: "1rem" },
});
```

**Presets** — a bundle of tokens with a name, for changing the whole feel in
one word. Your own tokens apply on top:

```tsx
theme: { preset: "glass", accent: "#7c3aed" }
```

| Preset | Look |
|---|---|
| `default` | Soft gradient, tinted border, accent glow |
| `minimal` | Flat, high-contrast, hard edges |
| `soft` | Rounder, airier, pill buttons |
| `glass` | Translucent and blurred, for tours over imagery |
| `contrast` | Thick borders, no shadow, no gradient |

A preset is *only* tokens — there is no preset-specific CSS, so it can never
do something you could not do by hand.

**Slot classes** — for a design system that owns its own styling:

```tsx
classNames: {
  card: "rounded-2xl shadow-xl ring-1 ring-black/5",
  title: "text-lg font-semibold tracking-tight",
  nextButton: "bg-indigo-600 hover:bg-indigo-500",
}
```

Slots: `card`, `header`, `progress`, `closeButton`, `body`, `title`, `copy`,
`footer`, `prevButton`, `nextButton`, `trigger`, `spotlight`, `tooltip`. Your
class is appended to the library's, so this adds to the default look. To
replace it outright, use the render-prop:
`<TutorialStage card={(args) => <MyCard {...args} />} />`.

Or set the CSS variables directly, which reaches everything including portaled
overlays:

```css
:root { --eto-accent: #262262; --eto-card-radius: 1rem; --eto-font: Inter, sans-serif; }
```

## Editing a tour

Authors drag the card and arrow into place, edit copy in a sidebar, and hit
Save. Two questions control who sees that: **may this user edit**, and **do
they want to right now**.

```tsx
export const tour = defineTutorial({
  id: "onboarding",
  store: httpStore("/tour.json", { saveTo: "/api/tutorial" }),
  editor: {
    permission: { allow: "dev-only" },   // or a plain boolean from your auth
  },
});
```

```tsx
// Reactive auth stays at the call site; the config stays a static module.
<TutorialProvider config={tour} canEdit={hasRole("admin")}>
```

An allowed user still has to unlock the editor — with `?edit=1` or
<kbd>Ctrl/Cmd</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd> — so authoring chrome never
ambushes an admin who just wanted to read the tour. The unlock persists for the
session. While it is unlocked, a yellow seam marks the tour's trigger button so
you can see you are in editing mode:

```
      ┌─ next-easytour ─┐
      │ [ ? Start Tour ]│
      └─────────────────┘
```

### The editor never runs in production

This is a rule, not a default. In a production build the editor is off and
**nothing turns it back on** — not `allow: true`, not a truthy `canEdit` from
your own auth, not `?edit=1`. `createTutorialFileRoute` refuses every write in
production too, ahead of `authorize`, so the save endpoint cannot outlive the
editor.

Author tutorials in development and deploy the JSON they produce. If you need
to author against a deployed environment, run it with `NODE_ENV=development`.

The editor UI is also **not shipped** to production. The handles, panel, and
seam live behind a dynamic import guarded by a build-time constant, so a
production build never references the chunk — it is absent from the build
manifest and from the served HTML. In development it loads as soon as you are
allowed to edit, so unlocking is instant.

| `permission` | Meaning |
|---|---|
| *(unset)* / `false` / `"never"` | Nobody edits. The default. |
| `true` / `"always"` | Allowed, unlocked immediately. |
| `"dev-only"` | Allowed outside production; unlock still required. |
| `{ allow, requireUnlock, unlockParam, unlockKey, persistUnlock }` | Full control. |

`allow` takes a plain boolean, so the library never calls your auth hook. Every
row above is additionally subject to the production rule.

### The save endpoint

Instead of hand-writing a route handler:

```ts
// app/api/tutorial/route.ts
import { createTutorialFileRoute } from "next-easytour/server";

export const { GET, POST } = createTutorialFileRoute({
  file: "public/tour.json",
  authorize: async (req) => (await getSession(req))?.role === "admin",
});
```

It validates the payload, refuses to overwrite a working file with an empty
one, writes atomically, and — without an `authorize` function — denies writes
outside development. `next-easytour/server` is Node-only; never import it from
a client component.

## Features

| Feature | Description |
|---|---|
| **One config object** | `defineTutorial({...})` — steps, theme, trigger, completion, permissions, in one place |
| **CSS-selector targeting** | `selector: "#foo"` — no code changes to target components |
| **Hook targeting** | `useTutorialTarget("id")` for dynamic/conditional elements |
| **Step actions** | `scroll-into-view`, `click`, `focus`, `highlight`, `add-class`, `dispatch`, `wait` |
| **WaitFor conditions** | Block Next until: click, input, DOM event, delay, element visible, custom predicate |
| **Auto-scroll** | `scrollIntoView: true` scrolls the target into view |
| **Auto-advance** | `autoAdvance: 3000` moves to next step after 3s |
| **Auto-start** | `autoStart: { once: true }` opens the tour for first-time visitors |
| **Highlight effects** | Pulsing ring around the target element |
| **Composable overlays** | Mix `<Card>`, `<Arrow>`, `<Spotlight>`, `<Circles>`, `<Labels>`, `<Tooltip>` |
| **Render-prop card** | `<TutorialStage card={(args) => <MyCard {...args} />} />` — full visual control |
| **Uniform card sizing** | Cards pre-measured for consistent height across all steps |
| **Completion tracking** | Cookie-based, automatic; `markOn: "last-step"` or `"finish"` |
| **Step stores** | Load and save steps over HTTP, localStorage, or a custom backend |
| **Legacy file formats** | 0.2/0.3 JSON is normalised on load — idempotently and losslessly |
| **Editor** | Drag card/arrow positions, configure overlays, save to JSON |
| **Editor permissions** | Explicit allow + unlock gesture, instead of a NODE_ENV guess |
| **Production-safe editor** | Off in production builds, with no override anywhere |
| **Editor seam** | Yellow outline round the trigger while authoring, so the mode is visible |
| **Responsive gating** | `minWidth: 768` via `matchMedia` — no hydration mismatch |
| **Host features** | Steps drive your app by name — `useTutorialFeature`, with auto state restore |
| **Feature editor** | The panel lists your app's features and builds a form from their params |
| **Theming** | 35 tokens, 5 presets, per-slot `classNames`, or raw CSS variables |
| **Dark mode** | Add `.dark` to an ancestor — CSS variables handle the rest |
| **TypeScript** | Fully typed with generic `Step<Meta>` for host metadata |
| **Framework-agnostic** | Works with Next.js, Vite, CRA — any React 18+ setup |

## Customising the card

Brand the card without re-listing the other overlays:

```tsx
<TutorialStage card={(args) => <MyCard {...args} />} />
```

Turn built-ins off individually, or add your own overlays as children:

```tsx
<TutorialStage overlays={{ spotlight: false }}>
  <MyCustomOverlay />
</TutorialStage>
```

## Wiring it by hand

The headless primitives are still exported and unchanged. Use them when you
need to own the state yourself:

```tsx
<Tutorial steps={steps} stepId={stepId} onStepChange={setStepId}>
  <Spotlight />
  <Arrow />
  <Card />
</Tutorial>
```

See [CHANGELOG.md](./CHANGELOG.md) for the 0.3 → 0.4 migration.

## Licence

MIT
