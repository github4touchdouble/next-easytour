# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-04-21

### Added

- Initial release.
- `TutorialOverlay` component with step-based navigation, animated SVG Bézier
  arrows, target-element highlighting, annotated ellipses, and controlled
  `step` / `onStepChange` API.
- Visual authoring editor (`debug={true}`) with drag handles for the arrow
  tip and circle shapes, per-step style sliders, and a Save callback.
- CSS-variable theming with optional dark-mode scope.
- Geometry helpers exported for custom arrow rendering and tests.
- TypeScript declarations, ESM-only distribution, `sideEffects` declared.
- JSON Schema for `TutorialStep[]` at `tutorial.schema.json`.
- `LLMS.md` / `AGENTS.md` reference for code assistants.
- Next.js App Router example under `examples/nextjs-app/`.
- Vite + React example under `examples/vite-react/`.