# next-easytour — code-assistant integration reference

```yaml
name: next-easytour
version: 0.3.0-alpha.3
branch: point-three
kind: react-component-library
language: typescript
module_type: esm
install: npm install next-easytour@next
peer_deps:
  react: ">=18.0.0"
  react-dom: ">=18.0.0"
import_path: next-easytour
stylesheet_path: next-easytour/styles.css
main_exports: [Tutorial, Card, Arrow, Spotlight, Circles, Tooltip, Editor, EditorHandles]
main_hooks: [useTutorial, useTutorialTarget, useEditorState, useCardRect]
requires_client_component: true
requires_app_router: false
framework_agnostic: true
ssr_safe: true
bundler: any
css_prefix: eto-
css_var_prefix: --eto-
```

## Minimum viable setup (CSS-selector targeting — no code changes)

```tsx
"use client";
import { useState } from "react";
import { Tutorial, Card, Arrow, Spotlight, type Step } from "next-easytour";

const steps: Step[] = [
  { id: "welcome", title: "Hi", body: "Welcome to the app.", autoAdvance: 3000 },
  {
    id: "save",
    title: "Save",
    body: "Click here to save.",
    selector: "#save-button",          // ← CSS selector, no hook needed
    scrollIntoView: true,
    highlight: true,
    annotations: {
      spotlight: true,
      arrow: { to: { space: "target", x: 50, y: 50 } },
    },
    waitFor: { type: "click" },        // wait for user to click the target
  },
];

export default function Page() {
  const [stepId, setStepId] = useState<string | null>(null);
  return (
    <>
      <button onClick={() => setStepId("welcome")}>Start tour</button>
      <button id="save-button">Save</button>
      <Tutorial steps={steps} stepId={stepId} onStepChange={setStepId}>
        <Spotlight />
        <Arrow />
        <Card variant="branded" logo="/logo.svg" />
      </Tutorial>
    </>
  );
}
```

## Two targeting modes

| Mode | When to use | Example |
|---|---|---|
| `selector: "#foo"` | Target exists in host markup, no code change wanted | `{ selector: "#nav-search" }` |
| `useTutorialTarget("foo")` | Target is dynamic / conditionally rendered | `const ref = useTutorialTarget("row-1")` |

Hook targets take precedence when both are present.

## Step actions (fire on step enter)

```tsx
actions: [
  { type: "scroll-into-view", behavior: "smooth" },
  { type: "wait", ms: 500 },
  { type: "click", selector: ".expand-btn" },
  { type: "highlight", pulse: true, duration: 2000 },
  { type: "add-class", selector: ".sidebar", className: "ring-2" },
  { type: "dispatch", event: "tour:demo", detail: { mode: "dark" } },
  { type: "focus", selector: "#email-input" },
]
```

## WaitFor conditions (block Next until met)

```tsx
waitFor: { type: "click" }                           // click on step target
waitFor: { type: "click", selector: ".submit" }      // click on specific element
waitFor: { type: "input", selector: "#name", pattern: "\\S+" }  // non-empty input
waitFor: { type: "event", name: "modal:closed" }     // custom DOM event
waitFor: { type: "delay", ms: 3000 }                 // time delay
waitFor: { type: "visible", selector: ".result" }    // element appears
waitFor: { type: "custom", predicate: () => count > 5 }  // custom function
```

## Key fields reference

| Field | Required? | Notes |
|---|---|---|
| `id` | **yes** | Unique string per step |
| `title` | no | Card heading |
| `body` | no | Card body text |
| `content` | no | JSX body (overrides `body`) |
| `selector` | no | CSS selector for target |
| `targets` | no | Hook-registered target IDs |
| `annotations.arrow` | no | Arrow to target |
| `annotations.spotlight` | no | Dim everything except target |
| `annotations.circles` | no | Ellipses on target |
| `scrollIntoView` | no | Scroll target into view |
| `actions` | no | Side-effects on step enter |
| `waitFor` | no | Block Next until condition met |
| `autoAdvance` | no | Auto-advance after N ms |
| `highlight` | no | Pulsing ring on target |
| `transition` | no | Card animation config |
| `cardAnchor` | no | Card position override |
| `meta` | no | Host-owned typed metadata |

## Coordinate systems — DO NOT MIX

```ts
type TargetPoint    = { space: "target";   x: number; y: number };  // % of target rect
type ViewportAnchor = { space: "viewport"; x: number; y: number };  // % of viewport
```

## Lifecycle callbacks

```
goto("A") →  onOpen, onStepEnter(A)
             actions execute, scrollIntoView fires
             waitFor starts watching
goto("B") →  onStepLeave(A), onStepEnter(B)
close()   →  onStepLeave(B), onClose
```

## Does NOT do

- Does not persist tour state.
- Does not ship analytics.
- Does not support nested tours.