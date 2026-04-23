# next-easytour

**Generalizable interactive tutorial overlays for React and Next.js.**

Build animated, step-by-step product tours that interact with your components — without modifying their source code.

```bash
npm install next-easytour@next
```

## Quick start

```tsx
// app/layout.tsx
import "next-easytour/styles.css";
```

```tsx
// app/page.tsx
"use client";
import { useState } from "react";
import { Tutorial, Card, Arrow, Spotlight, type Step } from "next-easytour";

const steps: Step[] = [
  {
    id: "welcome",
    title: "Welcome!",
    body: "Let me show you around.",
    autoAdvance: 3000,
  },
  {
    id: "search",
    title: "Search anything",
    body: "Type here to find what you need.",
    selector: "#search-input",         // CSS selector — no hook needed
    scrollIntoView: true,
    highlight: true,
    annotations: {
      spotlight: true,
      arrow: { to: { space: "target", x: 50, y: 50 } },
    },
    actions: [
      { type: "focus" },
    ],
    waitFor: { type: "input", pattern: "\\S+" },
  },
  {
    id: "done",
    title: "You're all set!",
    body: "Explore at your own pace.",
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
        <Card variant="branded" logo="/logo.svg" />
      </Tutorial>
    </>
  );
}
```

## Key features

| Feature | Description |
|---|---|
| **CSS-selector targeting** | Target any element via `selector: "#foo"` — no code changes to target components |
| **Hook targeting** | `useTutorialTarget("id")` for dynamic/conditional elements |
| **Step actions** | `scroll-into-view`, `click`, `focus`, `highlight`, `add-class`, `dispatch`, `wait` |
| **WaitFor conditions** | Block Next until: user click, text input, DOM event, delay, element visible, custom predicate |
| **Auto-scroll** | `scrollIntoView: true` scrolls the target into view smoothly |
| **Auto-advance** | `autoAdvance: 3000` moves to next step after 3s |
| **Highlight effects** | Pulsing ring around the target element |
| **Animated transitions** | Card entrance (`fade`/`fade-slide`/`scale`), arrow draw-on, spotlight morph |
| **Composable overlays** | Mix `<Card>`, `<Arrow>`, `<Spotlight>`, `<Circles>`, `<Tooltip>` as needed |
| **Branded card** | `<Card variant="branded" logo="..." />` — gradient header, progress dots, accent button |
| **Render-prop card** | Full control: `<Card>{(args) => <MyCard {...args} />}</Card>` |
| **Editor** | Drag card/arrow positions, save to JSON, `canEdit` gating |
| **Dark mode** | Add `.dark` to an ancestor — CSS variables handle the rest |
| **TypeScript** | Fully typed with generic `Step<Meta>` for host metadata |

## Theming

```css
:root {
  --eto-accent: #262262;         /* brand colour */
  --eto-surface: var(--background); /* card background */
}
```

## Licence

MIT