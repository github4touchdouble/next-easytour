# next-easytour — LLM integration reference

```yaml
name: next-easytour
version: 0.3.0
kind: react-component-library
language: typescript
module_type: esm
install: npm install next-easytour
peer_deps:
  react: ">=18.0.0"
  react-dom: ">=18.0.0"
import_path: next-easytour
stylesheet_path: next-easytour/styles.css
main_exports:
  - Tutorial          # headless provider (required)
  - Card              # step card (required)
  - Arrow             # Bézier/straight arrow overlay
  - Spotlight         # dimmer with target cutouts
  - Circles           # annotated ellipses on target
  - Labels            # text annotations with animation
  - Tooltip           # lightweight popover (no nav controls)
  - TriggerButton     # tutorial start button (annoying/default modes)
  - Editor            # authoring wrapper
  - EditorHandles     # drag handles for card/arrow
  - EditorPanel       # Figma-style sidebar editor
main_hooks:
  - useTutorial       # navigation API inside <Tutorial>
  - useTutorialTarget # register DOM element as named target
  - useTutorialDone   # cookie-based completion tracking
  - useEditorState    # editor state (active, unsavedCount, save)
  - useCardRect       # card bounding rect
requires_client_component: true
requires_app_router: false
framework_agnostic: true
ssr_safe: true
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
// app/page.tsx
"use client";
import { useState } from "react";
import { Tutorial, Card, Arrow, Spotlight, targetPoint, type Step } from "next-easytour";

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

export default function Page() {
  const [stepId, setStepId] = useState<string | null>(null);
  return (
    <>
      <button onClick={() => setStepId("welcome")}>Start tour</button>
      <input id="search-input" placeholder="Search..." />
      <Tutorial steps={steps} stepId={stepId} onStepChange={setStepId}>
        <Spotlight />
        <Arrow />
        <Card />
      </Tutorial>
    </>
  );
}
```

## Quick start — Vite + React

```tsx
// src/main.tsx
import "next-easytour/styles.css";
import App from "./App";
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
```

```tsx
// src/App.tsx  (no "use client" needed)
import { useState } from "react";
import { Tutorial, Card, Arrow, Spotlight, targetPoint, type Step } from "next-easytour";

const steps: Step[] = [
  { id: "welcome", title: "Welcome!", body: "Let me show you around." },
  {
    id: "btn",
    title: "Click me",
    body: "Click the button to continue.",
    selector: "#my-button",
    highlight: true,
    annotations: { spotlight: true, arrow: { to: targetPoint(50, 50) } },
    waitFor: { type: "click" },
  },
];

export default function App() {
  const [stepId, setStepId] = useState<string | null>(null);
  return (
    <>
      <button onClick={() => setStepId("welcome")}>Start tour</button>
      <button id="my-button">My button</button>
      <Tutorial steps={steps} stepId={stepId} onStepChange={setStepId}>
        <Spotlight />
        <Arrow />
        <Card />
      </Tutorial>
    </>
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
]
```

## WaitFor conditions

```tsx
waitFor: { type: "click" }                                        // click on target
waitFor: { type: "click", selector: ".submit" }                   // click on element
waitFor: { type: "input", selector: "#name", pattern: "\\S+" }   // regex match
waitFor: { type: "event", name: "modal:closed" }                  // custom DOM event
waitFor: { type: "delay", ms: 3000 }                              // time delay
waitFor: { type: "visible", selector: ".result" }                 // element appears
waitFor: { type: "custom", predicate: () => count > 5 }           // poll function
```

## Coordinates — DO NOT MIX

```ts
targetPoint(50, 50)     // { space: "target", x: 50, y: 50 }  — % of target rect
viewportAnchor(10, 20)  // { space: "viewport", x: 10, y: 20 } — % of viewport (fixed) or px (absolute)
```

## Custom card via render-prop

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

## TriggerButton + completion tracking

```tsx
import { TriggerButton, useTutorialDone } from "next-easytour";

// OUTSIDE <Tutorial>:
const { done, markDone } = useTutorialDone("my-tutorial");

<TriggerButton
  onClick={() => setStepId(steps[0].id)}
  text="Take the tour"
  mode="annoying"   // "annoying" = flashy until done; "default" = always calm
  done={done}
/>

// Mark complete on last step:
<Tutorial
  onStepEnter={(step) => {
    if (step.id === steps[steps.length - 1].id) markDone();
  }}
  ...
>
```

## Theming

```tsx
<Tutorial theme={{ accent: "#7c3aed", surface: "#fafafa", cardRadius: "16px" }} ...>
```

Or CSS:
```css
:root { --eto-accent: #262262; --eto-surface: var(--background); }
.dark { --eto-accent: #60a5fa; --eto-surface: #18181b; }
```

Properties: `accent`, `surface`, `fg`, `muted`, `mutedSoft`, `border`, `borderSoft`, `hoverBg`, `arrowColor`, `arrowOpacity`, `cardWidth`, `cardRadius`.

## Editor

```tsx
<Editor steps={baseSteps} canEdit={isAdmin} triggerConfig={{ text: "Start", mode: "annoying" }}
  onSave={async (steps, opts) => { await saveToServer(steps, opts?.triggerConfig); }}>
  {({ steps }) => (
    <Tutorial steps={steps} stepId={stepId} onStepChange={setStepId}>
      <Card /><Arrow /><Spotlight />
      {isAdmin && <EditorHandles />}
      {isAdmin && <EditorPanel />}
    </Tutorial>
  )}
</Editor>
```

## Lifecycle

```
setStepId("a") →  onOpen, onStepEnter(a), actions, scrollIntoView, waitFor
setStepId("b") →  onStepLeave(a), onStepEnter(b)
setStepId(null) → onStepLeave(b), onClose
```

## Does NOT do

- Persist tour state (host owns `stepId`)
- Ship analytics
- Support nested tours
- Require Next.js — works with any React 18+ setup