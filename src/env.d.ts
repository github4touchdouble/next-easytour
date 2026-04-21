/**
 * Minimal declaration of the `process.env.NODE_ENV` pattern we use in
 * a handful of dev-only `console.warn` branches. We don't depend on
 * `@types/node` because this library targets the browser — pulling
 * in all of Node's typings just to read one field is overkill.
 *
 * Bundlers (webpack/Next.js/tsup with `--env`) replace `process.env.
 * NODE_ENV` with a literal string at build time, so the `typeof
 * process !== "undefined"` guard is a belt-and-braces check for
 * environments where no bundler substitution happened. In those
 * cases `process` genuinely is undefined (pure browser, no bundler)
 * and the guard short-circuits before dereferencing.
 */
declare const process:
  | {
      env?: {
        NODE_ENV?: string;
      };
    }
  | undefined;