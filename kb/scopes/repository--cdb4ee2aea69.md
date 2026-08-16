---
title: Repository agent context
type: agent-context
scope: .
tags:
  - agents
  - architecture
  - context-engineering
---

# Repository agent context

The root `AGENTS.md` is the repository's normative control plane. Its rules apply before deeper lookup. Codex App SDK is a standalone public package whose headless stores, command semantics, persistence ports, lifecycle helpers, and optional React binding are owned here.

## Authority and repository seams

`AGENTS.md` owns instructions needed before editing. Repository `docs/` owns current multi-step procedures. Types, tests, schemas, and deterministic checkers own executable contracts. The KB owns pull-based rationale, history, evidence, maintained synthesis, plans, and relationships.

[[notes/documentation-ownership|Documentation ownership]] preserves that split. [[notes/repository-seams|Repository seams]] records package ownership, immutable dependency policy, design boundaries, and parallel-work constraints. This hub can explain those rules but cannot override them.

## Correctness before production

Apply unreasonably robust programming when agent work is cheap. Keep invalid states out of the model, parse foreign values from `unknown`, and pair readable regression examples with property tests for general laws. Freeze shared interfaces before parallel lanes begin and assign convergence files to one owner.

## Writing and planning

`WRITING.md` governs internal prose. `STYLE.md` adds the public prose contract. KB plans retain decisions, deviations, review findings, and reproducible evidence. Maintained notes own conclusions worth reusing after a plan reaches a terminal state.
