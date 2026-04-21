# next-easytour

A lightweight, fully-featured interactive tutorial overlay for React and Next.js applications. Step-based guide with animated SVG arrows, target-element highlighting, annotation circles, and an optional visual editor for authoring tours directly in the running UI.

Extracted from the [MuTopia](https://mutopia.sigscape.org) mutational-signature atlas and made framework-agnostic.

## Features

- Compact card UI with per-step title, body, and progress indicator
- Animated Bézier arrows connecting the card to target elements, with configurable bend, stroke, dash pattern, head size, and loop-end option
- Target percentages instead of viewport pixels — steps survive scroll, resize, and different screen sizes
- Annotated ellipses for highlighting regions within a target
- Built-in authoring mode: drag arrow tips, tweak styling via sliders, reposition and resize circles, and save the updated step list via a user-supplied callback
- CSS-variable theming — drop in without Tailwind, or override everything with your own class names
- No hard dependency on Next.js — works with Vite, CRA, Remix, or any React setup
- Small footprint, tree-shakeable, TypeScript first

## Installation

```bash
npm install next-easytour lucide-react
```

`react`, `react-dom`, and `lucide-react` are peer dependencies.

Import the default stylesheet once in your app:

```tsx
import "next-easytour/styles.css";
```

If you prefer to supply your own styles, skip the import and build your own CSS against the `.nto-*` class names the component emits.

## Quick start

```tsx
"use client";
import { useState } from "react";
import { TutorialOverlay, type TutorialStep } from "next-easytour";
import "next-easytour/styles.css";

const STEPS: TutorialStep[] = [
  {
    title: "Welcome",
    body: "This is your dashboard. Let me show you around.",
  },
  {
    title: "Save your work",
    body: "Hit this button to persist your changes.",
    target: "save-button",
    targetLabel: "Save",
    arrowTo: { x: 50, y: 50 },
    arrowStyle: { bend: 25 },
  },
  {
    title: "Browse your data",
    body: "Your recent entries show up here.",
    target: "data-list",
  },
];

export default function Page() {
  const [step, setStep] = useState<number | null>(null);

  return (
    <>
      <button onClick={() => setStep(0)}>Start tour</button>

      <button data-tutorial-id="save-button">Save</button>
      <div data-tutorial-id="data-list">...</div>

      {step !== null && (
        <TutorialOverlay
          steps={STEPS}
          step={step}
          onStepChange={setStep}
          onClose={() => setStep(null)}
        />
      )}
    </>
  );
}
```

Tag any element with `data-tutorial-id="your-id"` and reference it from a step's `target` field. The overlay handles arrow positioning, scroll/resize tracking, and the pulsing highlight ring automatically.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `steps` | `TutorialStep[]` | — | Ordered list of steps (required). |
| `step` | `number` | — | Index of the active step (controlled). |
| `onStepChange` | `(i: number) => void` | — | Called when the user navigates. |
| `onClose` | `() => void` | — | Called when the user closes or finishes. |
| `isDark` | `boolean` | `false` | Hint for dark themes. |
| `logoSrc` | `string` | — | URL of a logo shown in the header. |
| `logoWidth` | `number` | `44` | Logo width in px. |
| `logoHeight` | `number` | `14` | Logo height in px. |
| `headerLabel` | `string` | `"Guide"` | Text shown next to the logo. |
| `ImageComponent` | `ImageLike` | plain `<img>` | Custom image component (e.g. `next/image`). |
| `onAction` | `(action, i) => void` | — | Called when a step's `action` field is non-empty. |
| `debug` | `boolean` | `false` | Enables the visual authoring editor. |
| `onSave` | `SaveHandler` | — | Called when the user saves in debug mode. Falls back to clipboard. |
| `onSaved` | `() => void` | — | Called after a successful save. |

## The `TutorialStep` shape

```ts
interface TutorialStep {
  title: string;
  body: string;
  target?: string;                  // data-tutorial-id of the element to highlight
  targetLabel?: string;             // small caption at the arrow tip
  arrowTo?: { x: number; y: number }; // tip position as % of target (0–100)
  arrowStyle?: ArrowStyle;          // per-step style overrides
  circles?: TutorialCircle[];       // annotated ellipses on the target
  action?: string;                  // surfaced through `onAction` for host-driven effects
  [key: string]: unknown;           // arbitrary metadata preserved through save/load
}
```

Unknown fields on a step are passed through unchanged when the editor saves — this is how host apps attach their own metadata (highlight colours, filter selections, view modes, etc.) without the library needing to know about them.

### `ArrowStyle`

```ts
interface ArrowStyle {
  bend?: number;       // 5–80, default 30
  flip?: boolean;      // mirror the arc, default false
  strokeWidth?: number; // default 1.5
  dashed?: boolean;    // default false
  headSize?: number;   // default 8
  loopEnd?: boolean;   // replace arrowhead with a loop, default false
}
```

### `TutorialCircle`

```ts
interface TutorialCircle {
  x: number;       // centre x as % of target width
  y: number;       // centre y as % of target height
  r: number;       // horizontal radius as % of target width
  ry?: number;     // vertical radius (defaults to r → circle)
  rot?: number;    // rotation in degrees
  label?: string;  // caption below the ellipse
}
```

When a step has circles, the arrow is suppressed; the circles emit their own connector lines from the card.

## Authoring mode

Set `debug={true}` and the card gains a Save button plus a live editor:

- **Drag the blue dot** at the arrow tip to reposition it. Dot turns amber once dirty.
- **Bend / weight / head** sliders update arrow style for this step only.
- **Flip / dash / loop** checkboxes toggle arrow variants.
- **Purple circle handles** (centre, rx, ry, rotate) let you position and resize annotation ellipses.
- **Save** invokes `onSave(steps)`. On success the overrides clear and `onSaved` fires. On failure the JSON is copied to the clipboard.

Typical wiring against a Next.js API route:

```tsx
<TutorialOverlay
  {...rest}
  debug={process.env.NODE_ENV === "development"}
  onSave={async (steps) => {
    const res = await fetch("/api/tutorial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(steps),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }}
  onSaved={() => refetchSteps()}
/>
```

Example API route (`app/api/tutorial/route.ts`):

```ts
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Dev only" }, { status: 403 });
  }
  const body = await req.json();
  await fs.writeFile(
    path.join(process.cwd(), "public", "tutorial.json"),
    JSON.stringify(body, null, 2) + "\n",
    "utf-8",
  );
  return NextResponse.json({ ok: true });
}
```

## Theming

The default stylesheet uses CSS custom properties. Override them anywhere in your app:

```css
:root {
  --nto-accent: #10b981;      /* was Google blue */
  --nto-fg: #1f2937;
  --nto-muted: #6b7280;
  --nto-arrow: #4b5563;
}
```

Available variables: `--nto-accent`, `--nto-border`, `--nto-border-soft`, `--nto-bg-start`, `--nto-bg-end`, `--nto-shadow`, `--nto-fg`, `--nto-muted`, `--nto-muted-soft`, `--nto-hover-bg`, `--nto-arrow`, `--nto-arrow-opacity`.

For dark mode, the component sets `.nto-dark` on itself when `isDark={true}`; the stylesheet provides dark values under that scope. Override `.nto-dark { --nto-foo: ... }` to theme the dark variant independently.

If you want full control, skip `styles.css` entirely and write your own CSS against the class names the component emits: `.nto-card`, `.nto-header`, `.nto-body`, `.nto-footer`, `.nto-progress-seg`, `.nto-nav-back`, `.nto-nav-next`, `.nto-btn`, `.nto-close`, `.nto-debug-*`, `.nto-arrow-svg`, `.nto-circles-svg`, `.nto-debug-handle`, `.tutorial-highlight`. Also keyframes: `nto-card-in`, `nto-arrow-draw`, `nto-arrow-pulse`, `nto-highlight-pulse`, `nto-line-in`, `nto-ellipse-in`, `nto-label-in`.

## Using `next/image` for the logo

```tsx
import Image from "next/image";

<TutorialOverlay
  {...rest}
  logoSrc="/logo.svg"
  ImageComponent={Image as never}  // prop types aren't perfectly compatible; cast is safe
/>
```

The library treats `ImageComponent` as a minimal `(src, alt, width, height, style) => JSX` contract — any component that accepts those five props works.

## Driving host effects from steps

Attach an `action` string to any step and provide `onAction` to react to it:

```tsx
const STEPS = [
  { title: "Scroll down", body: "...", action: "scrollToBottom" },
  { title: "Open panel", body: "...", action: "openSettings" },
];

<TutorialOverlay
  {...rest}
  onAction={(action, i) => {
    if (action === "scrollToBottom") window.scrollTo({ top: 99999, behavior: "smooth" });
    if (action === "openSettings") setSettingsOpen(true);
  }}
/>
```

The library itself never interprets the value of `action`; that's entirely yours.

## Geometry helpers

The arrow math is exported separately for reuse or testing:

```ts
import {
  DEFAULT_STYLE,
  autoTargetPoint,
  resolvePoint,
  cardSourcePx,
  pixelToRelative,
  buildPath,
} from "next-easytour";
```

All functions are pure aside from DOM lookups that use `document.querySelector`.

## License

MIT.
