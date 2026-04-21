# next-easytour

Headless, composable tutorial overlay for React and Next.js. Compose
`<Tutorial>` + `<Card>` + `<Arrow>` + `<Spotlight>` + `<Circles>` with
full branding control, drag-to-author editor, typed coordinate systems.

> **0.3.0 is on the `point-three` branch and published as an alpha.**
> It's a full rewrite of 0.2.x. See `MIGRATING.md`. The stable 0.2.x
> API continues to receive bug-fix releases on `master`.

## Install

```bash
npm install next-easytour@next
```

Peer deps: `react` >= 18, `react-dom` >= 18.

```tsx
import "next-easytour/styles.css";
```

## Quick start

```tsx
"use client";
import { useState } from "react";
import {
  Tutorial,
  Card,
  Arrow,
  Spotlight,
  useTutorialTarget,
  type Step,
} from "next-easytour";
import "next-easytour/styles.css";

const steps: Step[] = [
  { id: "welcome", title: "Welcome", body: "Let me show you around." },
  {
    id: "save",
    title: "Save your work",
    body: "Click here to save.",
    targets: ["save-button"],
    annotations: {
      spotlight: true,
      arrow: { to: { space: "target", x: 50, y: 90 } },
    },
  },
  { id: "done", title: "That's it", body: "Enjoy." },
];

function SaveButton() {
  const ref = useTutorialTarget("save-button");
  return <button ref={ref}>Save</button>;
}

export default function Page() {
  const [stepId, setStepId] = useState<string | null>(null);
  return (
    <>
      <button onClick={() => setStepId("welcome")}>Start tour</button>
      <SaveButton />
      <Tutorial
        steps={steps}
        stepId={stepId}
        onStepChange={setStepId}
      >
        <Spotlight />
        <Arrow />
        <Card />
      </Tutorial>
    </>
  );
}
```

That's the full working tour — three primitives, a provider, a target
hook, and a state pair.

## Public surface

### Components

| Component | Purpose |
|---|---|
| `<Tutorial>` | Headless provider. Renders no DOM; holds state and context. |
| `<Card>` | Tutorial card. Default or render-prop layout. |
| `<Arrow>` | Bézier arrow from card to target. Auto-routes from the card's nearest edge. |
| `<Spotlight>` | Dim everything except the step's targets (SVG mask cutout). |
| `<Circles>` | Annotated ellipses drawn on the target. |
| `<Editor>` | Authoring mode wrapper. Merges drag-edits into steps, surfaces save. |
| `<EditorHandles>` | Drag handles for the card and arrow tip. |

### Hooks

| Hook | Returns |
|---|---|
| `useTutorial<Meta>()` | The full navigation API: `status`, `step`, `index`, `total`, `isFirst`, `isLast`, `canAdvance`, `next`, `prev`, `goto`, `close`. |
| `useTutorialTarget<E>(id)` | A callback ref to attach to an element. |
| `useEditorState()` | Editor snapshot: `active`, `unsavedCount`, `saveStatus`, `save`, `revert`. |
| `useCardRect()` | The card's live bounding rect. Useful for custom overlays that align to the card. |

### Types

`Step<Meta>`, `TargetPoint`, `ViewportAnchor`, `Annotations`,
`ArrowAnnotation`, `ArrowStyle`, `Circle`, `TutorialApi`,
`TutorialProps`, `TutorialStatus`, `CanEdit`, `EditorState`,
`SaveHandler`, plus component prop types.

### Constructors

`targetPoint(x, y)` and `viewportAnchor(x, y)` stamp the `space`
discriminator for you when writing steps in TypeScript.

## Full example — branded card + authoring editor

```tsx
"use client";
import { useState } from "react";
import {
  Tutorial,
  Card,
  Arrow,
  Spotlight,
  Circles,
  Editor,
  EditorHandles,
  useEditorState,
  useTutorialTarget,
  type Step,
} from "next-easytour";
import "next-easytour/styles.css";

interface Meta {
  action?: "scroll-to-top" | "open-panel";
}

const steps: Step<Meta>[] = [
  { id: "intro", title: "Welcome" },
  {
    id: "chart",
    title: "This is the chart",
    targets: ["chart"],
    annotations: {
      spotlight: true,
      arrow: { to: { space: "target", x: 50, y: 10 } },
      circles: [{ x: 70, y: 40, r: 12, label: "this cluster" }],
    },
    meta: { action: "scroll-to-top" },
  },
];

function BrandedCard() {
  return (
    <Card>
      {({ step, index, total, isFirst, isLast, canAdvance, next, prev, close }) => (
        <>
          <div className="brand-header">
            <img src="/logo.svg" alt="" height={16} />
            <span>Guide {index + 1} / {total}</span>
            <button onClick={close}>×</button>
          </div>
          <div className="brand-body">
            <h4>{step.title}</h4>
            <p>{step.body}</p>
          </div>
          <div className="brand-footer">
            <button onClick={prev} disabled={isFirst}>Back</button>
            <button onClick={next} disabled={!canAdvance}>
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </>
      )}
    </Card>
  );
}

export default function Page({ isAdmin }: { isAdmin: boolean }) {
  const [stepId, setStepId] = useState<string | null>(null);
  const chartRef = useTutorialTarget<HTMLDivElement>("chart");

  return (
    <div>
      <div ref={chartRef}>...your chart...</div>

      <Editor
        steps={steps}
        canEdit={isAdmin}
        onSave={async (next) => {
          await fetch("/api/tutorial", {
            method: "POST",
            body: JSON.stringify(next),
          });
        }}
      >
        {({ steps }) => (
          <Tutorial<Meta>
            steps={steps}
            stepId={stepId}
            onStepChange={setStepId}
            onStepEnter={(step) => {
              if (step.meta?.action === "scroll-to-top") {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
          >
            <Spotlight />
            <Arrow />
            <Circles />
            <BrandedCard />
            <EditorHandles />
          </Tutorial>
        )}
      </Editor>
    </div>
  );
}
```

## Theming

Every visual token is a CSS variable under the `--eto-` prefix.

```css
:root {
  --eto-accent: #262262;
  --eto-surface: var(--background);
}
.dark {
  --eto-accent: #72D0F6;
  --eto-surface: var(--background);
}
```

See `src/styles.css` for the full list (border colours, shadows,
z-index layers, card radius, card width).

## Authoring

In the running app (with `canEdit` active), drag the card handle (top-
left of the card) to reposition. Drag the dot at the arrow tip to re-
aim. Double-click the card handle to reset. Hit Save — the library
calls your `onSave(steps)` with the full updated step list.

## SSR

Fully SSR-safe on Next.js App Router. The Provider and every hook are
`"use client"`. The components render nothing on the server (step
`null`); on the client they mount observers once the target DOM is
ready.

## Comparison with 0.2.x

| | 0.2.x | 0.3.0 |
|---|---|---|
| Main component | `<TutorialOverlay>` (all-in-one) | `<Tutorial>` + composables |
| Branding | Props (`logoSrc`, `headerLabel`) | Render-prop card |
| Target registration | `data-tutorial-id` attribute | `useTutorialTarget` hook |
| Custom step metadata | Index signature, untyped | `Step<Meta>` generic, typed |
| Authoring mode | Inside overlay | Separate `<Editor>` wrapper |
| Navigation key | Array index | Step id string |
| Lifecycle | `onAction(string)` | `onOpen` / `onClose` / `onStepEnter` / `onStepLeave` |

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

Tests: 80 cases across `tests/state.test.ts`, `tests/coords.test.ts`,
`tests/geometry.test.ts`, `tests/Tutorial.test.tsx`,
`tests/Editor.test.tsx`.

## Licence

MIT. © Jan P Hummel.