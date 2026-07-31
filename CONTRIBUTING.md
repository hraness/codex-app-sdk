# Contributing

Issues and focused pull requests are welcome.

Open an issue before starting a broad API, persistence, or compatibility change so the contract can be agreed first. Maintainers review changes for runtime portability, immutable-state behavior, generation fencing, explicit ambiguous outcomes, persistence safety, and readable tests.

Install dependencies and run the complete local gate:

```sh
bun install
bun run check
```

Every concrete behavior change needs a readable unit test. Add a property test when the change affects ordering, transitions, retries, conditional writes, generation monotonicity, cancellation, or selector identity.

Keep the root entrypoint framework-neutral. React belongs in `@hraness/codex-app-sdk/react`, and deterministic adapters belong in `@hraness/codex-app-sdk/testing`.
