# Architecture

Codex App SDK separates five concerns that commonly become entangled in chat interfaces: provider protocol compatibility, application state, commands, recovery persistence, and rendering.

## Boundaries

The version adapter owns the app-server process, JSONL transport, generated request and notification types, protocol parsing, and compatibility policy. It translates validated provider input into application facts and translates closed application intents into exact versioned requests. That adapter is private to the application runtime.

The model owns immutable snapshots, pure reducers, source coordinates, and selectors. It has no transport or persistence dependencies.

The client owns lifecycle and command outcomes. It validates and snapshots an operation registry when the host is created, then delegates provider work to a driver typed by that same registry. Each intent name selects its own input and output type, and reconciliation carries the same operation name so heterogeneous command results never collapse into one union. A driver must return a confirmed, ambiguous, rejected, or cancelled outcome instead of leaking transport exceptions through the command API.

Persistence adapters implement narrow compare-and-set, mutation-journal, generation, and change-feed contracts. Rendering reads stores through selectors. React is one optional rendering adapter.

Operation descriptors carry a positive bounded timeout, effect class, lost-response rule, concurrency scope, and reconciliation strategy. The client host enforces the registry membership, descriptor consistency, lost-response failure rule, and reconciliation availability. An application driver or scheduler enforces timeout and concurrency policy because those policies require application-owned execution and concurrency keys. They allow thread-scoped mutations to serialize independently from source-scoped account operations. A non-idempotent mutation always has an ambiguous lost-response rule and an explicit automatic, manual, or unsupported reconciliation strategy.

## State flow

```text
validated notification
  -> application fact with SourceCoordinate
  -> reducer commit
  -> listener invalidation
  -> selector
  -> rendered view
```

`SourceCoordinate` orders facts only within one source. A higher generation supersedes every coordinate from a lower generation. Within a generation, sequence orders protocol messages and index orders multiple facts projected from one message.

The reducer store uses root identity to decide whether a commit changed state. It installs the new root before notification and visits a stable listener copy. Subscription changes during notification affect later commits. Listener exceptions are isolated and may be reported to an application-owned safe error sink.

## Command flow

Every intent has an application-owned attempt ID. Reads enter the model through facts, while mutations pass through the journal before reaching the provider:

```text
intent
  -> prepare(attempt)
  -> markEffectStarted(attempt, expectedRevision)
  -> driver dispatch
  -> settle(attempt, expectedRevision, outcome)
  -> authoritative facts
  -> reducer
```

Preparing first establishes durable identity and recovery metadata. Marking effect-started before the call makes a crash in either direction conservative. A recovered effect-started record has an unknown provider outcome and therefore requires reconciliation.

Every draft carries an opaque identifier or keyed digest for its intended effect and recovery identity. Preparing an existing attempt ID returns `existing` only when the operation, source, and fingerprint match. A mismatch returns `collision` and leaves the original record untouched. The journal's discriminated definition union keeps each operation correlated with its recovery and resolution types, and settlement repeats the operation so the adapter can verify that correlation against the durable record.

The transition matrix is exact. Prepared attempts may settle only as rejected or cancelled, which are positive no-effect claims. Effect-started attempts may settle as confirmed, ambiguous, rejected, or cancelled. A settled attempt is terminal. Every transition compares the expected revision, settlement compares the operation and attempt ID, and transition timestamps cannot precede the state they replace.

The journal never stores an arbitrary intent automatically. Its `recovery` type is chosen by the application and should contain only the minimum reviewed data needed to reconcile. A plain deterministic hash of low-entropy sensitive input remains guessable, so it is not a safe fingerprint. The same content rule applies to durable resolution values.

## Ambiguity

Transport failure does not prove operation failure. A non-idempotent command whose response was lost may have changed provider state. Its operation descriptor declares a reconciliation strategy such as querying the authority, resuming an authoritative thread, or requiring manual review.

The client host resolves the descriptor before invoking the driver. A value that is not an own registry operation is rejected without reaching the driver. A descriptor must repeat its registry key and carry a valid semantics combination. Registry descriptors and their critical fields must be own data properties on plain or null-prototype records, so getters and inherited values cannot change policy between validation and use.

The host rejects a driver outcome with the wrong attempt ID, an invalid shape, ambiguity for a safe-to-retry operation, or reconciliation metadata that differs from the descriptor. Outcome fields follow the same own-data rule. An accepted outcome is normalized into a freshly frozen SDK envelope rather than returning the driver's mutable object. The host copies portable error metadata but does not inspect or recursively freeze an application-defined confirmed result.

An unexpected driver rejection or contract violation follows the descriptor's lost-response rule. Reads and idempotent mutations return a sanitized retryable rejection because repeating them is safe. The host does not repeat them automatically. Non-idempotent mutations return an ambiguous outcome containing the descriptor's declared strategy. This rule applies even when the underlying exception occurred before the provider effect because the host cannot prove where an application driver failed.

Only operations with an `automatic` or `manual` reconciliation strategy enter the typed `client.reconcile` and driver reconciliation methods. A `manual` strategy can represent an operator-triggered resolver implemented by the driver. An `unsupported` strategy remains useful on an ambiguous dispatch outcome, but the type system excludes it from those methods and the runtime rejects crafted calls. A driver may return `rejected` only when it can establish the requested effect did not succeed, except for the host's explicit safe-to-retry failure mapping. A `cancelled` outcome is also a positive no-effect claim. An effect-started attempt may settle as cancelled only when the driver can establish that the requested effect did not occur; otherwise the interruption is ambiguous and requires reconciliation.

When a driver returns `cancelled` after the combined command signal aborts, the host derives `caller` or `client-closing` from the signal that won the abort race. It does not trust the driver's label. Without an observed abort, the driver may return only `superseded`; a caller or closing cancellation without the matching signal is a contract violation.

A start failure is terminal for that host. The caller must close it and construct a replacement rather than retrying a partially initialized driver. Start failures exposed to callers and lifecycle state are sanitized through `ClientHostLifecycleError`. Closing aborts and waits for an active start before driver cleanup, preventing resources from being acquired after close.

## Generations

A generation fences notifications and responses from an older runtime. `GenerationStore.reserve` must atomically return a value greater than both its durable current value and the caller's observed floor. `reserveMonotonicGeneration` validates one returned value against the caller's floor. Adapter concurrency tests must establish durable atomicity and uniqueness across reservations.

An in-memory `GenerationFence` is useful inside one process. Durable runtimes must initialize or reserve from persistent state so a restart cannot reuse a generation.

## Persistence

Bindings and checkpoints use compare-and-set revisions. A versioned slot discriminates `present` from `deleted`, so a legitimate nullable application value cannot collide with a tombstone. Deletion preserves the revision, so delete and recreate cycles cannot reset a key and admit an old writer. A stale writer receives the current slot and cannot overwrite it silently.

Projection checkpoints include a schema name, schema version, content-policy identifier, source coordinate, and creation time. They are portable acceleration data, not the transcript authority. An application can discard an incompatible checkpoint and hydrate again.

The change feed exposes ordered entries and an invalidation subscription. Cursors are adapter-owned and opaque to consumers. Mutation-attempt pagination uses ascending `(preparedAtMs, attemptId)` order, with portable code-unit ordering for an attempt-ID tie. SQLite and Convex adapters must implement the same comparison. A local adapter may signal after a SQLite transaction. A hosted adapter may map a Convex subscription to the same invalidation contract.

No port accepts a generic runtime snapshot. This keeps credentials, raw RPC data, local paths, provider-only identifiers, command arguments, and unreviewed transcript content outside persistence by default.

## Rendering

`useExternalStoreSelector` builds on React's external-store contract. The selector is recomputed only for a new root snapshot. If the selected value is equal according to the supplied equality function, the hook reuses the identity React already committed.

Components receive selected application views and a command port. They do not consume raw provider events, own hydration cursors, infer operation success from connection state, or implement retries.

## Protocol compatibility

The package does not expose one provider protocol version as a stable application API. Applications pin and test their adapter separately, parse foreign values at that boundary, and publish only app-level facts and intents to this SDK.

Protocol upgrades should update the private adapter and its compatibility evidence without forcing UI components, persistence implementations, or selectors to understand generated wire types.
