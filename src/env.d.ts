// Minimal ambient declaration for `process.env.NODE_ENV`.
//
// This library runs in the browser but reads `process.env.NODE_ENV` so
// bundlers (webpack, Vite, tsup, esbuild) can dead-code-eliminate the
// dev-only branches at build time — every modern bundler replaces the
// expression with a string literal.
//
// We declare only what we actually use, instead of pulling in `@types/node`
// which would leak server-side globals (Buffer, setImmediate, __dirname, …)
// into consumers' autocomplete.
declare const process: {
  env: {
    NODE_ENV?: "development" | "production" | "test" | string;
  };
};