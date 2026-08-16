<!-- kb:context scopes/repository--cdb4ee2aea69 -->
# Contents

- `src/` – framework-neutral client contracts, immutable stores, operation semantics, persistence ports, lifecycle helpers, an optional React binding, and deterministic testing adapters.
- `docs/` – architecture and persistence guidance.
- `.agents/skills/` – portable cross-repository KB and phased-execution workflows.
- `kb/` – authored repository rationale, maintained synthesis, and implementation plans.
- `WRITING.md` and `STYLE.md` – internal and public prose contracts.
- `portfolio-inventory.json` and `scripts/check-portfolio-inventory.ts` – canonical public package inventory and its standalone consistency gate.
- `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, and `LICENSE` – usage, contribution, vulnerability-reporting, and licensing terms.
- `package.json`, `tsconfig.json`, and `bun.lock` – the standalone package and verification configuration.

# Guidelines

- Use Bun 1.3.14 for repository commands and keep emitted ESM portable to modern browsers, Bun, and Node.js according to each export's documented boundary.
- Follow `WRITING.md` for internal prose and `STYLE.md` for public prose.
- Apply unreasonably robust programming when agent work is cheap. Model invalid states out of existence, parse every foreign value from `unknown`, and pair readable deterministic regressions with property tests for parsers, ordering, transitions, conditional writes, and round trips.
- Pin Hraness dependencies to reviewed immutable releases or full commits. Never connect repositories through sibling paths, Git submodules, or coordinated `main` assumptions; upgrade each consumer independently.
- Extract a shared package only after two concrete consumers require the same stable interface. Keep every shared package product-neutral and free of product imports.
- Keep the React binding headless and styling-agnostic. Consumers may layer accessible primitives from `@hraness/ui`, stable optional composition from `@hraness/design-kit`, and product-owned layout and content without coupling those systems to this package.
- Keep Direct deterministic compositions and adapters development-only and outside every production dependency graph and published export.
- Freeze package interfaces before parallel lanes begin. Give exports, manifests, lockfiles, generated output, and other convergence surfaces one owner while lanes edit disjoint paths.
- Keep mandatory rules in the closest `AGENTS.md`, current procedures in `docs/`, executable contracts in types and tests, and pull-based rationale, evidence, synthesis, and plans in `kb/`.
- Keep the root package framework-neutral and side-effect-free. React belongs behind `@hraness/codex-app-sdk/react`; deterministic adapters belong behind `@hraness/codex-app-sdk/testing`.
- Keep provider wire methods, generated protocol contracts, credentials, local paths, and persistence implementations outside the root package.
- Model application commands as closed intent unions and command results as confirmed, ambiguous, rejected, or cancelled. Never retry an ambiguous mutation without reconciliation.
- Preserve immutable snapshots, post-commit listener notification, listener isolation, generation fencing, compare-and-set persistence, and prepare-before-effect mutation journaling.
- Keep persistence adapters narrow. SQLite and Convex implementations should satisfy the same ports without exposing a generic snapshot database.
- Pair readable behavior tests with property tests for ordering, transitions, conditional writes, monotonic generations, and selector identity.
- Treat this repository as the complete project. Use only its public names, files, paths, commands, and examples.
- Keep `portfolio-inventory.json` byte-canonical and consistent with the public package identity, version, repository, and direct `@hraness/*` dependency edges.
- Run `bun run check` before handing off a change.
