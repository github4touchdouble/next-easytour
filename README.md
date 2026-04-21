# next-easytour

Interactive tutorial overlay for React and Next.js. Step-based guide with animated SVG arrows, element highlighting, annotation ellipses, and an optional in-app editor for authoring tours.

> **Using a code assistant?** See [`LLMS.md`](./LLMS.md) / [`AGENTS.md`](./AGENTS.md) for a dense integration reference.

```yaml
install: npm install next-easytour lucide-react
peer_deps: [react >=18, react-dom >=18, lucide-react >=0.300]
import: import { TutorialOverlay } from "next-easytour"
stylesheet: import "next-easytour/styles.css"
requires_use_client: true       # Next.js App Router
ssr_safe: true
```

## Install

```bash
npm install next-easytour lucide-react
```

`react`, `react-dom`, and `lucide-react` are peer dependencies. Import the stylesheet once at the app root:

```tsx
// app/layout.tsx  (Next.js App Router)
// pages/_app.tsx  (Next.js Pages Router)
// src/main.tsx    (Vite / CRA)
import "next-easytour/styles.css";
```

## Setup checklist

1. Install the package and peer deps.
2. Import `next-easytour/styles.css` once at the app root.
3. Add `"use client";` to the file that renders `<TutorialOverlay>` (App Router only).
4. Tag each highlight target with `data-tutorial-id="your-id"`.
5. Hold `step: number | null` in state; render the overlay only when `step !== null`.

## Quick start

```tsx
"use client";
import { useState } from "react";
import { TutorialOverlay, type TutorialStep } from "next-easytour";

const STEPS: TutorialStep[] = [
  { title: "Welcome", body: "This is your dashboard." },
  {
    title: "Save",
    body: "Persist your changes here.",
    target: "save-button",
    targetLabel: "Save",
    arrowTo: { x: 50, y: 50 },
    arrowStyle: { bend: 25 },
  },
  { title: "Data", body: "Recent entries appear here.", target: "data-list" },
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

The id in `data-tutorial-id` is a bare string, **not** a CSS selector. Arrow positioning, scroll/resize tracking, and the highlight ring are handled internally.

## API

### `<TutorialOverlay />`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `steps` | `TutorialStep[]` | — | Ordered step list (required). |
| `step` | `number` | — | Active step index (controlled). |
| `onStepChange` | `(i: number) => void` | — | Navigation callback. |
| `onClose` | `() => void` | — | Close / finish callback. |
| `isDark` | `boolean` | `false` | Dark-theme hint; toggles `.nto-dark`. |
| `logoSrc` | `string` | — | Header logo URL. |
| `logoWidth` / `logoHeight` | `number` | `44` / `14` | Logo dimensions in px. |
| `headerLabel` | `string` | `"Guide"` | Text beside the logo. |
| `ImageComponent` | `ImageLike` | `<img>` | Swap in `next/image` or similar. |
| `onAction` | `(action, i) => void` | — | Fires when a step has a non-empty `action`. |
| `canEdit` | `CanEdit` | `"auto"` | Who can open the authoring editor. See [Authoring mode](#authoring-mode). |
| `debug` | `boolean` | — | **Deprecated** since 0.2.0; alias for `canEdit` kept for 0.1.x back-compat. Removed in 0.3.0. |
| `onSave` | `SaveHandler` | — | Save callback; falls back to clipboard. |
| `onSaved` | `() => void` | — | Fires after a successful save. |

### `TutorialStep`

```ts
interface TutorialStep {
  title: string;
  body: string;
  target?: string;                     // data-tutorial-id value
  targetLabel?: string;
  arrowTo?: { x: number; y: number };  // tip position, 0–100 % of target
  arrowStyle?: ArrowStyle;
  circles?: TutorialCircle[];          // suppresses the arrow when present
  action?: string;                     // surfaced via onAction
  [key: string]: unknown;              // unknown fields preserved on save
}
```

A JSON Schema for `TutorialStep[]` is available at [`tutorial.schema.json`](./tutorial.schema.json).

### `ArrowStyle` / `TutorialCircle`

```ts
interface ArrowStyle {
  bend?: number;        // 5–80, default 30
  flip?: boolean;       // mirror the arc
  strokeWidth?: number; // default 1.5
  dashed?: boolean;
  headSize?: number;    // default 8
  loopEnd?: boolean;    // replace head with a loop
}

interface TutorialCircle {
  x: number; y: number;   // centre, % of target
  r: number; ry?: number; // radii, % of target width; ry defaults to r
  rot?: number;           // degrees
  label?: string;
}
```

## Common mistakes

| Mistake | Fix |
|---|---|
| `target: "#save-button"` | `target: "save-button"` — bare id, matches `data-tutorial-id` exactly. |
| Importing `styles.css` inside a Client Component. | Import it once in the root layout / app entry. |
| Forgetting `"use client";` in Next.js App Router. | Required in the file that renders `<TutorialOverlay>`. |
| Passing `step={null}`. | `step` is `number`. Gate the overlay: `{step !== null && <TutorialOverlay ... />}`. |
| Using `next/image` without `ImageComponent`. | `ImageComponent={Image as never}`. |
| Mounting the overlay inside `overflow: hidden`. | Mount it at the page root; it is `position: fixed`. |
| Passing a bare hook function to `canEdit`. | Wrap it: `canEdit={{ useCanEdit: useMyHook }}`. Plain functions are called as predicates, not hooks. |

## Authoring mode

The library ships a visual editor for authoring tours in the running UI — drag the arrow tip, adjust stroke / bend / head, resize circle annotations. **Save** invokes `onSave(steps)`; on failure the JSON is copied to the clipboard.

Access is controlled by the `canEdit` prop, which accepts four shapes:

```ts
type CanEdit =
  | boolean                             // explicit on/off
  | "auto"                              // on in dev, off in prod (default)
  | (() => boolean)                     // sync predicate
  | { useCanEdit: () => boolean };      // user-supplied React hook
```

### Auto (default)

Omit the prop. The editor appears when `process.env.NODE_ENV === "development"` and disappears in production builds:

```tsx
<TutorialOverlay {...rest} />   // editor visible in dev only
```

### Explicit boolean

```tsx
<TutorialOverlay {...rest} canEdit={true}  />   // always visible
<TutorialOverlay {...rest} canEdit={false} />   // always hidden
```

### `localStorage` toggle

The built-in `useLocalStorageCanEdit` hook reads a boolean from `localStorage`. Flip it from the browser console without redeploying:

```tsx
import { TutorialOverlay, useLocalStorageCanEdit } from "next-easytour";

<TutorialOverlay
  {...rest}
  canEdit={{ useCanEdit: () => useLocalStorageCanEdit() }}
/>;
```

```js
// In the browser console:
localStorage.setItem("next-easytour:debug", "true");
// Reload — the editor appears.
```

Pass a different key to isolate multiple tours: `useLocalStorageCanEdit("tour:onboarding:debug")`.

### Role-based gate

When the decision depends on async or context-driven state, pass a hook:

```tsx
import { useAuth } from "./auth";

<TutorialOverlay
  {...rest}
  canEdit={{ useCanEdit: () => useAuth().role === "admin" }}
/>;
```

The embedded function **must** obey the Rules of Hooks — it is called from a stable top-level site inside the overlay. Treat it exactly like any other custom hook.

### Save callback

Regardless of how access is granted, Save still goes through `onSave`:

```tsx
<TutorialOverlay
  {...rest}
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

Dev-only API route (`app/api/tutorial/route.ts`):

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

## Actions

`action` strings are opaque to the library; interpret them in `onAction`:

```tsx
<TutorialOverlay
  {...rest}
  onAction={(action) => {
    if (action === "scrollToBottom") window.scrollTo({ top: 99999, behavior: "smooth" });
    if (action === "openSettings") setSettingsOpen(true);
  }}
/>
```

## `next/image` logo

```tsx
import Image from "next/image";

<TutorialOverlay {...rest} logoSrc="/logo.svg" ImageComponent={Image as never} />;
```

`ImageComponent` only needs to accept `src`, `alt`, `width`, `height`, `style`.

## Theming

Override CSS variables:

```css
:root {
  --nto-accent: #10b981;
  --nto-fg: #1f2937;
  --nto-muted: #6b7280;
  --nto-arrow: #4b5563;
}
```

Full variable set: `--nto-accent`, `--nto-border`, `--nto-border-soft`, `--nto-bg-start`, `--nto-bg-end`, `--nto-shadow`, `--nto-fg`, `--nto-muted`, `--nto-muted-soft`, `--nto-hover-bg`, `--nto-arrow`, `--nto-arrow-opacity`. Scope dark overrides under `.nto-dark`.

Component class names: `.nto-card`, `.nto-header`, `.nto-body`, `.nto-footer`, `.nto-progress-seg`, `.nto-nav-back`, `.nto-nav-next`, `.nto-btn`, `.nto-close`, `.nto-debug-*`, `.nto-arrow-svg`, `.nto-circles-svg`, `.nto-debug-handle`, `.tutorial-highlight`.

## Geometry helpers

Exported for reuse or testing:

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

## Examples

- [`examples/nextjs-app/`](./examples/nextjs-app) — Next.js App Router with authoring mode.
- [`examples/vite-react/`](./examples/vite-react) — minimal Vite + React setup.

## License

MIT.