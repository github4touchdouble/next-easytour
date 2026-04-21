# next-easytour · Vite + React example

Minimal setup. Proves the library has no Next.js dependency.

```bash
cd examples/vite-react
npm install
npm run dev
```

Key differences from the Next.js example:

- No `"use client";` directive — Vite has no server-component model.
- The stylesheet is imported in `src/main.tsx`, the app entry point.
- Everything else (`TutorialStep` shape, props, `data-tutorial-id`) is identical.