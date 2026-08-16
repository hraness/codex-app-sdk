---
title: Repository seams
type: concept
tags:
  - architecture
  - dependencies
  - repositories
repository_scopes:
  - AGENTS.md
  - docs
  - package.json
  - src
---

# Repository seams

Codex App SDK owns framework-neutral state, command, lifecycle, persistence-port, and deterministic-testing contracts. Provider wire protocols, generated provider types, credentials, and concrete persistence systems remain in consumers or dedicated adapters.

The package currently declares no Hraness runtime dependency. Any future shared dependency must use a reviewed immutable release or full commit so consumers can upgrade independently. Do not connect development through sibling paths, Git submodules, or coordinated `main` workflows. Extract another shared package only after two concrete consumers need the same stable, product-neutral interface.

The optional React binding remains headless and styling-agnostic. Consumers may layer accessible primitives from `@hraness/ui`, optional stable composition from `@hraness/design-kit`, and product-owned layout and content without adding either edge to this package. Direct adapters and worlds are development-only and must never enter published exports or production dependency graphs.

Freeze command, persistence, and export contracts before parallel lanes. Give the export map, package manifest, generated output, and lockfile one owner while independent lanes change disjoint implementation and test paths.

## Related

The normative rules remain in the root `AGENTS.md`. [[documentation-ownership|Documentation ownership]] explains how those rules relate to executable contracts and this pull-based context.
