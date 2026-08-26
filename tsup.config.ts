import { defineConfig } from "tsup";

/**
 * Two entry points with different targets, so they get different builds:
 *
 *   - `next-easytour`        — browser. React is external.
 *   - `next-easytour/server` — Node 18+. `fs` and `path` stay external
 *     (esbuild normalises the `node:` prefix away on output), so pulling
 *     this entry into a client bundle fails to resolve rather than
 *     shipping a filesystem shim to the browser.
 */
export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    clean: true,
    platform: "browser",
    external: ["react", "react-dom"],
    // Copied here rather than by a shell step after tsup: `clean` wipes
    // dist at the start of the build, and a consumer running `next dev`
    // against a linked checkout would fail to resolve the stylesheet for
    // as long as the gap lasted.
    onSuccess: "cp src/styles.css dist/styles.css",
  },
  {
    entry: ["src/server/index.ts"],
    outDir: "dist/server",
    format: ["esm"],
    dts: true,
    platform: "node",
    target: "node18",
    external: ["node:fs", "node:path", "react", "react-dom"],
  },
]);
