# next-easytour

**Interactive tutorial overlays for React and Next.js.**

Build animated, step-by-step product tours that interact with your components — without modifying their source code.

```bash
npm install next-easytour
```

## Quick start

```tsx
// app/layout.tsx (Next.js) or src/main.tsx (Vite)
import "next-easytour/styles.css";
```

```tsx
// app/page.tsx
"use client";
import { useState } from "react";
import { Tutorial, Card, Arrow, Spotlight, targetPoint, type Step } from "next-easytour";

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
    selector: "#search-input",
    scrollIntoView: true,
    highlight: true,
    annotations: {
      spotlight: true,
      arrow: { to: targetPoint(50, 50) },
    },
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
        <Card />
      </Tutorial>
    </>
  );
}
```

## Features

| Feature | Description |
|---|---|
| **CSS-selector targeting** | `selector: "#foo"` — no code changes to target components |
| **Hook targeting** | `useTutorialTarget("id")` for dynamic/conditional elements |
| **Step actions** | `scroll-into-view`, `click`, `focus`, `highlight`, `add-class`, `dispatch`, `wait` |
| **WaitFor conditions** | Block Next until: click, input, DOM event, delay, element visible, custom predicate |
| **Auto-scroll** | `scrollIntoView: true` scrolls the target into view |
| **Auto-advance** | `autoAdvance: 3000` moves to next step after 3s |
| **Highlight effects** | Pulsing ring around the target element |
| **Composable overlays** | Mix `<Card>`, `<Arrow>`, `<Spotlight>`, `<Circles>`, `<Labels>`, `<Tooltip>` |
| **Render-prop card** | `<Card>{(args) => <MyCard {...args} />}</Card>` — full visual control |
| **Uniform card sizing** | Cards pre-measured for consistent height across all steps |
| **Trigger button** | `<TriggerButton mode="annoying" done={done} />` with completion tracking |
| **Editor** | Drag card/arrow positions, configure overlays, save to JSON |
| **Theming** | CSS custom properties or `<Tutorial theme={{...}}>` prop |
| **Dark mode** | Add `.dark` to an ancestor — CSS variables handle the rest |
| **TypeScript** | Fully typed with generic `Step<Meta>` for host metadata |
| **Framework-agnostic** | Works with Next.js, Vite, CRA — any React 18+ setup |

## Theming

```css
:root {
  --eto-accent: #262262;
  --eto-surface: var(--background);
}
```

Or programmatically:

```tsx
<Tutorial theme={{ accent: "#7c3aed", surface: "#fafafa" }} ...>
```

## Licence

MIT