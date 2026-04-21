# next-easytour — LLM integration guide

Dense, copy-paste reference for code assistants adding this library to an app.
This file is identical to `AGENTS.md`. If you are a human, read `README.md` instead.

```yaml
name: next-easytour
version: 0.2.0
kind: react-component-library
language: typescript
module_type: esm
install: npm install next-easytour lucide-react
peer_deps:
  react: ">=18.0.0"
  react-dom: ">=18.0.0"
  lucide-react: ">=0.300.0"
import_path: next-easytour
stylesheet_path: next-easytour/styles.css
main_export: TutorialOverlay
requires_client_component: true           # Next.js App Router: needs "use client"
requires_app_router: false                # works with Pages Router, Vite, CRA, Remix
framework_agnostic: true
ssr_safe: true                            # renders nothing on server; mounts on client
bundler: any                              # tsup-built ESM
```

## Setup checklist

Perform in order. Do not skip steps.

1. **Install.** `npm install next-easytour lucide-react`
2. **Import the stylesheet once**, at the app root.
   - Next.js App Router → `app/layout.tsx`.
   - Next.js Pages Router → `pages/_app.tsx`.
   - Vite / CRA → `src/main.tsx` or equivalent entry.
   - Code: `import "next-easytour/styles.css";`
3. **In the file that renders the overlay, add `"use client";`** at the top (Next.js App Router only). The overlay uses `useState`, `useEffect`, and DOM APIs.
4. **Tag each target element** with `data-tutorial-id="your-id"`. The id is a bare string, not a CSS selector.
5. **Hold two pieces of state**: `step: number | null` (active step index, `null` = tour closed) and your step array.
6. **Render the overlay conditionally** only when `step !== null`. Do not pass `null` to the `step` prop.

## Minimum working example

Verbatim, ready to paste into an App Router page:

```tsx
"use client";

import { useState } from "react";
import { TutorialOverlay, type TutorialStep } from "next-easytour";

const STEPS: TutorialStep[] = [
  { title: "Welcome", body: "Let me show you around." },
  {
    title: "Save",
    body: "Click this to persist changes.",
    target: "save-button",
    targetLabel: "Save",
    arrowTo: { x: 50, y: 50 },
  },
];

export default function Page() {
  const [step, setStep] = useState<number | null>(null);

  return (
    <>
      <button onClick={() => setStep(0)}>Start tour</button>
      <button data-tutorial-id="save-button">Save</button>

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

The stylesheet import goes in `app/layout.tsx`, not in this file.

## Prop contract (required vs optional)

Required: `steps`, `step`, `onStepChange`, `onClose`.
Everything else is optional. Default values are noted in `src/types.ts` JSDoc and exported as `DEFAULT_STYLE` for the arrow.

## TutorialStep contract

```ts
{
  title: string;         // required
  body: string;          // required
  target?: string;       // data-tutorial-id value, not "#id" or ".class"
  targetLabel?: string;
  arrowTo?: { x: number; y: number };  // 0–100, % of target rect
  arrowStyle?: { bend?: number; flip?: boolean; strokeWidth?: number; dashed?: boolean; headSize?: number; loopEnd?: boolean };
  circles?: Array<{ x: number; y: number; r: number; ry?: number; rot?: number; label?: string }>;
  action?: string;       // surfaced via onAction; library does not interpret
  // unknown keys are preserved through save/load round-trips
}
```

## Common mistakes to avoid

| Mistake | Correct form |
|---|---|
| Passing a CSS selector as `target`. | Pass the bare id: `target: "save-button"` ↔ `data-tutorial-id="save-button"`. |
| Importing `styles.css` inside a Client Component. | Import it once in the root layout / app entry. |
| Forgetting `"use client";` in the file using `<TutorialOverlay>`. | Required on Next.js App Router. |
| Passing `step={null}`. | The `step` prop is `number`. Gate the whole component: `{step !== null && <TutorialOverlay ... />}`. |
| Using `next/image` without the `ImageComponent` prop. | Pass it explicitly: `ImageComponent={Image as never}`. A plain `<img>` is the default. |
| Assuming the arrow targets a CSS position. | `arrowTo` is a percentage of the *target element's* bounding box, re-resolved on every render. |
| Mutating a step object in place. | Treat `steps` as immutable; the editor returns a new array via `onSave`. |
| Rendering the overlay inside an element with `overflow: hidden`. | The card is `position: fixed`; SVG arrows use viewport coordinates. Mount it at the page root. |
| Passing a bare function as `canEdit={useMyHook}` and expecting hook semantics. | Wrap it: `canEdit={{ useCanEdit: useMyHook }}`. Plain functions are called as predicates; only the wrapper shape is called as a hook. |
| Using `debug={true}` in 0.2.0+. | Still works but deprecated. Switch to `canEdit={true}`; `debug` is removed in 0.3.0. |

## Exports

```ts
// Component
import { TutorialOverlay } from "next-easytour";

// Types
import type {
  TutorialOverlayProps,
  TutorialStep,
  TutorialCircle,
  ArrowStyle,
  ArrowPoint,
  SaveHandler,
  ImageLike,
  CanEdit,
} from "next-easytour";

// Hooks
import { useLocalStorageCanEdit } from "next-easytour";

// Geometry helpers (pure functions; exported for custom arrow rendering or tests)
import {
  DEFAULT_STYLE,
  autoTargetPoint,
  resolvePoint,
  cardSourcePx,
  pixelToRelative,
  buildPath,
} from "next-easytour";

// Stylesheet (side-effect import)
import "next-easytour/styles.css";
```

## JSON schema for step arrays

A JSON Schema for `TutorialStep[]` is published at `tutorial.schema.json` in the repo root. Use it for editor autocompletion, validation, or prompt-time constraint. Reference it in an authored `tutorial.json` via:

```json
{
  "$schema": "https://unpkg.com/next-easytour/tutorial.schema.json",
  "steps": [ /* TutorialStep objects */ ]
}
```

## Authoring mode (`canEdit`)

The authoring editor is controlled by the `canEdit` prop. Type:

```ts
type CanEdit =
  | boolean                             // explicit on/off
  | "auto"                              // on in dev, off in prod — default when prop is omitted
  | (() => boolean)                     // sync predicate, called on every render
  | { useCanEdit: () => boolean };      // user-supplied React hook
```

Canonical patterns:

- **Dev-only (default):** omit the prop.
- **Always on:** `canEdit={true}`.
- **localStorage toggle:** `canEdit={{ useCanEdit: () => useLocalStorageCanEdit() }}`.
- **Role gate:** `canEdit={{ useCanEdit: () => useAuth().role === "admin" }}`.

`useLocalStorageCanEdit(key?)` is exported from the package. Default key is `"next-easytour:debug"`. Set the key's value to `"true"` in the browser to enable the editor; the hook is SSR-safe and re-renders when the key changes in another tab.

Clicking Save invokes `onSave(steps)`; on failure the JSON is copied to the clipboard. Omitting `onSave` also falls back to clipboard.

The old `debug` prop is **deprecated** as of 0.2.0. It still works and takes precedence over `canEdit` to preserve behaviour, but logs a dev warning and will be removed in 0.3.0.

## Theming

Override CSS variables under `:root` or `.nto-dark`. Full list in `README.md` § Theming. The accent variable is `--nto-accent`; everything else derives from it via `color-mix()`.

## Things this library deliberately does not do

- It does not persist tour state. Store `step` and `steps` yourself.
- It does not scroll targets into view. Use `action: "scrollTo..."` + `onAction` if needed.
- It does not ship analytics. Wire `onStepChange` to your own tracker.
- It does not read from the DOM synchronously on mount; allow one tick before a target is required.
- It does not provide a Provider or Context; pass props directly.