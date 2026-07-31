# Contents

- `src/` – framework-neutral client contracts, immutable stores, operation semantics, persistence ports, lifecycle helpers, an optional React binding, and deterministic testing adapters.
- `docs/` – architecture and persistence guidance.
- `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, and `LICENSE` – usage, contribution, vulnerability-reporting, and licensing terms.
- `package.json`, `tsconfig.json`, and `bun.lock` – the standalone package and verification configuration.

# Guidelines

- Use Bun 1.3.14 for repository commands and keep emitted ESM portable to modern browsers, Bun, and Node.js according to each export's documented boundary.
- Keep the root package framework-neutral and side-effect-free. React belongs behind `@hraness/codex-app-sdk/react`; deterministic adapters belong behind `@hraness/codex-app-sdk/testing`.
- Keep provider wire methods, generated protocol contracts, credentials, local paths, and persistence implementations outside the root package.
- Model application commands as closed intent unions and command results as confirmed, ambiguous, rejected, or cancelled. Never retry an ambiguous mutation without reconciliation.
- Preserve immutable snapshots, post-commit listener notification, listener isolation, generation fencing, compare-and-set persistence, and prepare-before-effect mutation journaling.
- Keep persistence adapters narrow. SQLite and Convex implementations should satisfy the same ports without exposing a generic snapshot database.
- Pair readable behavior tests with property tests for ordering, transitions, conditional writes, monotonic generations, and selector identity.
- Treat this repository as the complete project. Use only its public names, files, paths, commands, and examples.
- Run `bun run check` before handing off a change.
