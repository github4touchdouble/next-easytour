/**
 * Ambient declarations.
 *
 * `process.env.NODE_ENV` is read in a handful of dev-only `console.warn`
 * branches, and `next-easytour/server` genuinely runs on Node. Both are
 * covered by `@types/node`, which is a **devDependency**: it types this
 * source tree at build time and never reaches consumers, because the
 * emitted `.d.ts` files expose only DOM and React types.
 *
 * Client code still guards with `typeof process !== "undefined"` before
 * dereferencing. Bundlers replace `process.env.NODE_ENV` with a literal
 * at build time, but in a pure-browser, no-bundler environment `process`
 * really is undefined and the guard has to short-circuit — the types say
 * it exists, the runtime does not always agree.
 */

export {};
