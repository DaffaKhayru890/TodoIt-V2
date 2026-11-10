// Bun configuration for the TodoIt-V2 monorepo.
// The test suite imports modules using the `@/*` path alias defined in
// `web/tsconfig.app.json`.  Bun's test runner does not automatically read
// the TypeScript compiler options, so we need to provide an explicit alias
// mapping.  The alias maps `@/*` to the TypeScript source under `web/src`.
// This ensures that imports such as `@/test/fixtures/todos` resolve
// correctly when running `bun test`.

export default {
  alias: {
    // Map the `@/*` alias to the TypeScript source in the `web` package.
    // The path is relative to the project root, so we omit the leading
    // './' which Bun interprets as an absolute path from the current
    // working directory.  Using just `web/src/*` ensures that imports
    // such as `@/core/utils/join-classes` resolve correctly.
    '@/*': 'web/src/*',
  },
};
