# next-easytour — code-assistant integration reference

This file is identical to `LLMS.md`. Read this if you are an LLM
helping a developer add or migrate to next-easytour. Humans should
read `README.md` and `MIGRATING.md`.

```yaml
name: next-easytour
version: 0.3.0-alpha.0
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
main_exports: [Tutorial, Card, Arrow, Spotlight, Circles, Editor, EditorHandles]
main_hooks: [useTutorial, useTutorialTarget, useEditorState, useCardRect]
requires_client_component: true       # Next.js App Router — add "use client"
requires_app_router: false            # works with Pages Router, Vite, CRA, Remix
framework_agnostic: true
ssr_safe: true
bundler: any
css_prefix: eto-
css_var_prefix: --eto-
```

## Minimum viable setup

Three requirements:

1. Import the stylesheet once at the app root.
2. Wrap the portion of UI the tour can target in `<Tutorial>`.
3. Register each target element with `useTutorialTarget(id)` and spread
   the returned ref on the element.

```tsx
// app/layout.tsx (Next.js) or equivalent
import "next-easytour/styles.css";
```

```tsx
"use client";
import { useState } from "react";
import {
  Tutorial, Card, Arrow, Spotlight,
  useTutorialTarget, type Step,
} from "next-easytour";

const steps: Step[] = [
  { id: "welcome", title: "Hi", body: "..." },
  {
    id: "save",
    title: "Save",
    body: "...",
    targets: ["save"],
    annotations: {
      spotlight: true,
      arrow: { to: { space: "target", x: 50, y: 90 } },
    },
  },
];

function SaveButton() {
  const ref = useTutorialTarget("save");
  return <button ref={ref}>Save</button>;
}

export default function Page() {
  const [stepId, setStepId] = useState<string | null>(null);
  return (
    <>
      <button onClick={() => setStepId("welcome")}>Start</button>
      <SaveButton />
      <Tutorial steps={steps} stepId={stepId} onStepChange={setStepId}>
        <Spotlight />
        <Arrow />
        <Card />
      </Tutorial>
    </>
  );
}
```

## Mandatory step fields

| Field | Required? | Notes |
|---|---|---|
| `id` | **yes** | Unique string per step. Used for navigation. |
| `title` | no | Default `<Card>` renders this if present. |
| `body` | no | Default `<Card>` renders this if present. |
| `targets` | no | `string[]`. Matches `useTutorialTarget` ids. |
| `annotations.arrow` | no | Requires at least one registered target. |
| `annotations.circles` | no | Percentages of target rect. |
| `annotations.spotlight` | no | `true`/`false`. |
| `cardAnchor` | no | `{ space: "viewport", x, y }`. |
| `meta` | no | Host-owned, typed via `Step<Meta>` generic. |

## Coordinate systems — DO NOT MIX

The library has two coordinate systems. They are distinct types:

```ts
type TargetPoint    = { space: "target";   x: number; y: number };  // % of target rect
type ViewportAnchor = { space: "viewport"; x: number; y: number };  // % of viewport
```

- `annotations.arrow.to` → **`TargetPoint`**.
- `annotations.circles[i]` x/y/r/ry → percentages of the target rect
  (not wrapped in a TargetPoint; these are bare numbers — see
  `tutorial.schema.json`).
- `cardAnchor` → **`ViewportAnchor`**.

TypeScript catches accidental mixing. JavaScript users get a runtime
no-op if the discriminator is missing.

## Target registration

Required pattern (0.3.0 removed the `data-tutorial-id` attribute
convention):

```tsx
import { useTutorialTarget } from "next-easytour";

function Row() {
  const ref = useTutorialTarget<HTMLDivElement>("row-1");
  return <div ref={ref}>...</div>;
}
```

The hook returns a callback ref. It automatically registers on mount,
de-registers on unmount, and handles the case where the same hook site
swaps between two different DOM nodes (conditional rendering).

## Common mistakes

| Mistake | Fix |
|---|---|
| `step.target: "foo"` (scalar) | `step.targets: ["foo"]` (array) |
| `{ x: 50, y: 90 }` as `arrow.to` | Must include `space: "target"` |
| `{ x: 50, y: 85 }` as `cardAnchor` | Must include `space: "viewport"` |
| Step without `id` | Every step needs a unique string id |
| `<TutorialOverlay>` | Use `<Tutorial>` + composed overlay components |
| `data-tutorial-id="foo"` | Use `useTutorialTarget("foo")` |
| `onAction` prop | Use `onStepEnter` + `step.meta.action` |
| `isDark` prop | Add `.dark` class to an ancestor |
| `debug` prop | Use `canEdit` on `<Editor>` |
| Reading custom fields directly on step | Put them under `step.meta`, type via `Step<Meta>` |
| Stepping by index | Steps are keyed by `id`; use `goto(id)` |

## Lifecycle callbacks

Fire order when the tour goes from `closed` to step A to step B to
`closed`:

```
goto("A") →  onOpen, onStepEnter(A)
goto("B") →  onStepLeave(A), onStepEnter(B)
close()   →  onStepLeave(B), onClose
```

Host side-effect code for each step belongs in `onStepEnter`. Cleanup
belongs in `onStepLeave` (or `onClose` for teardown specific to the
tour ending).

```tsx
<Tutorial<MyMeta>
  steps={steps}
  stepId={stepId}
  onStepChange={setStepId}
  onOpen={() => snapshotAppState()}
  onClose={() => restoreAppState()}
  onStepEnter={(step) => applyEffects(step.meta)}
  onStepLeave={(step) => cleanupEffects(step.meta)}
>
  ...
</Tutorial>
```

## Custom card (branded)

When `<Card>` has no children, it renders a generic default. For any
branding, use render-prop mode:

```tsx
<Card>
  {({ step, index, total, isFirst, isLast, canAdvance, next, prev, close }) => (
    <>
      <Header logo="/my-logo.svg" progress={`${index + 1}/${total}`} onClose={close} />
      <Body title={step.title} text={step.body} />
      <Footer onBack={prev} backDisabled={isFirst}
              onNext={next} nextDisabled={!canAdvance}
              nextLabel={isLast ? "Done" : "Next"} />
    </>
  )}
</Card>
```

The outer `<div className="eto-card">` is always rendered by the
library (for positioning, focus, rect publication to `<Arrow>`); your
JSX goes inside.

## Authoring / editor

Wrap `<Tutorial>` with `<Editor>`, mount `<EditorHandles>` inside:

```tsx
<Editor
  steps={baseSteps}
  canEdit={isAdmin}
  onSave={async (mergedSteps) => {
    await fetch("/api/tour", {
      method: "POST",
      body: JSON.stringify(mergedSteps),
    });
  }}
  onSaved={() => refetchSteps()}
>
  {({ steps }) => (
    <Tutorial steps={steps} stepId={stepId} onStepChange={setStepId}>
      <Spotlight /><Arrow /><Card /><EditorHandles />
    </Tutorial>
  )}
</Editor>
```

`canEdit` accepts:

- `boolean` — explicit.
- `"auto"` — on in `NODE_ENV=development`, off in production. Default.
- `() => boolean` — synchronous predicate.
- `{ useCanEdit: () => boolean }` — a hook. Required shape when the
  check itself calls other hooks.

`useEditorState()` returns `{ active, unsavedCount, saveStatus, save, revert }`
for hosts that want to render their own save button or status
indicator.

## Theming

Override CSS variables under `:root` or `.dark` (or your framework's
equivalent dark-mode selector — the library doesn't care which class
name, only that `--eto-*` variables are in scope).

```css
:root {
  --eto-accent: #262262;               /* brand colour */
  --eto-surface: var(--background);    /* card surface — optional */
}
```

Complete variable list is in `src/styles.css`; commonly useful ones:

```
--eto-accent          brand colour (single source of truth)
--eto-surface         card background (defaults: #fff / #18181b)
--eto-border          card border
--eto-fg              card foreground text
--eto-muted           muted body text
--eto-arrow           arrow stroke colour
--eto-arrow-opacity   arrow stroke opacity
--eto-card-width      min(480px, calc(100vw - 2rem))
--eto-card-radius     0.5rem
--eto-card-z          z-index (55)
```

## Validation in development

The library logs `console.warn` on:

- Duplicate step ids.
- Empty step ids.
- Steps with no content AND no annotations.
- `useTutorialTarget` called outside a `<Tutorial>` subtree.

All warnings are dev-only and no-op in production.

## Does NOT do

- Does not persist tour state. Store `stepId` in React state (or URL).
- Does not scroll targets into view automatically. Use `onStepEnter`
  to scroll.
- Does not ship analytics. Wire `onStepChange` / `onStepEnter`.
- Does not provide a Context from the package root; state flows
  through `<Tutorial>` only.
- Does not support nested tours. Mount one `<Tutorial>` at a time.