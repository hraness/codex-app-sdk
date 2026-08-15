# Codex App SDK

Codex App SDK is an independent TypeScript toolkit for building interfaces over the official Codex app-server protocol. It supplies immutable state stores, typed application commands, explicit mutation outcomes, lifecycle fencing, narrow persistence ports, and an optional React selector hook.

The public package identity is `@hraness/codex-app-sdk`. This project is not an official OpenAI SDK and is not affiliated with or endorsed by OpenAI. It does not claim npm registry publication.

## Install from a tagged source release

Pin a reviewed repository tag when one is available:

```json
{
  "dependencies": {
    "@hraness/codex-app-sdk": "github:hraness/codex-app-sdk#v0.1.1"
  }
}
```

Then install with Bun:

```sh
bun install
```

## Design

The UI is a function of immutable state:

```text
provider notifications
  -> private versioned adapter
  -> application facts
  -> pure reducer
  -> immutable external store
  -> selectors
  -> UI
```

Raw RPC methods, generated wire values, transport envelopes, and provider version details stay inside an application-owned adapter. Components select stable views from an `ExternalStore` and send closed application intents through a `CodexAppClient`.

Commands always produce one explicit outcome:

- `confirmed` means the authority confirmed the result.
- `ambiguous` means an effect may have happened and must be reconciled.
- `rejected` means the client has no confirmed result. A retryable rejection is safe to repeat under the operation descriptor.
- `cancelled` means the driver established that the requested effect did not occur.

The client host binds the operation registry at runtime. An unexpected driver failure for a read or idempotent mutation becomes a sanitized, retryable `rejected` outcome. The same failure for a non-idempotent mutation becomes `ambiguous` with the operation's declared reconciliation strategy. The host does not retry either case automatically.

Registry descriptors, command envelopes, and driver outcome envelopes require own data properties on plain or null-prototype records. Accessors and inherited policy fields fail closed. Every accepted outcome is copied into a frozen SDK envelope, and cancellation caused by an in-flight abort records whether the caller or the closing client initiated it.

## Package entries

- `@hraness/codex-app-sdk` contains framework-neutral contracts and helpers.
- `@hraness/codex-app-sdk/react` contains `useExternalStoreSelector`.
- `@hraness/codex-app-sdk/testing` contains deterministic memory adapters and scripted fixtures.

The React peer is optional. Importing the package root does not load React.

## Define application operations

```ts
import {
  createCodexAppClientHost,
  defineOperation,
  defineOperationRegistry,
  type CodexAppDriver,
  type OperationInput,
  type OperationOutput,
} from "@hraness/codex-app-sdk";

type SendMessageInput = Readonly<{
  threadId: string;
  text: string;
}>;

type SendMessageOutput = Readonly<{
  turnId: string;
}>;

const operations = defineOperationRegistry({
  sendMessage: defineOperation<SendMessageInput, SendMessageOutput>({
    effect: "non-idempotent-mutation",
    lostResponse: "ambiguous",
    timeoutMs: 30_000,
    concurrency: "per-thread",
    reconciliation: {
      kind: "automatic",
      strategy: "client-message-id",
    },
  }),
});

type Input = OperationInput<typeof operations.sendMessage>;
type Output = OperationOutput<typeof operations.sendMessage>;

type Snapshot = Readonly<{ activeTurnId: string | null }>;
declare const driver: CodexAppDriver<Snapshot, typeof operations>;
const client = createCodexAppClientHost(operations, driver);
```

The discriminated operation semantics prevent a read or idempotent mutation from declaring an ambiguous lost-response policy. Timeouts are positive bounded integers, concurrency distinguishes parallel, source, thread, and global serialization, and every non-idempotent mutation names its automatic, manual, or unsupported reconciliation strategy. The application driver or scheduler enforces timeout and concurrency policy.

The same registry types and guards the client boundary. The host validates and snapshots every descriptor when it is created. A crafted operation that is not an own registry entry is rejected before the driver runs. `CodexIntent<typeof operations, "sendMessage">` requires the operation's input, and `client.dispatch(intent)` returns only that operation's output type.

`client.reconcile` accepts only non-idempotent operations whose strategy is `automatic` or `manual`. An `unsupported` strategy can still describe an ambiguous dispatch outcome, but it cannot enter the client or driver reconciliation path. Reconciliation includes the operation name with the attempt ID, preserving the same result correlation.

## Create immutable state

```ts
import { createReducerStore } from "@hraness/codex-app-sdk";

type Snapshot = Readonly<{ count: number }>;
type Action = Readonly<{ type: "increment" }>;

const store = createReducerStore<Snapshot, Action>(
  { count: 0 },
  (snapshot) => ({ count: snapshot.count + 1 }),
);

store.subscribe(() => {
  console.log(store.getSnapshot().count);
});

store.dispatch({ type: "increment" });
```

A reducer must return a new root value for a change. The store commits before notifying a stable copy of its listeners. One listener throwing cannot prevent the remaining listeners from observing the commit.

## Select state in React

```tsx
import type { ExternalStore } from "@hraness/codex-app-sdk";
import { useExternalStoreSelector } from "@hraness/codex-app-sdk/react";

type Snapshot = Readonly<{ count: number }>;

function Count({ store }: { store: ExternalStore<Snapshot> }) {
  const count = useExternalStoreSelector(
    store,
    (snapshot) => snapshot.count,
  );
  return <span>{count}</span>;
}
```

An optional equality function preserves a previously committed selected identity across unrelated root revisions and selector replacement.

## Persist recovery metadata

The persistence surface is deliberately narrower than a database abstraction:

- `BindingStore` stores application-to-provider bindings with compare-and-set revisions.
- `MutationAttemptJournal` durably prepares attempts, records that an effect may begin, and stores terminal outcomes.
- `ProjectionCheckpointStore` stores explicitly versioned, content-reviewed projections.
- `GenerationStore` atomically reserves monotonically increasing generations.
- `ChangeFeed` reads ordered portable application changes and signals invalidation.

A mutation follows this order:

```text
derive an opaque request identifier or keyed digest
  -> prepare attempt durably
  -> mark effect-started durably
  -> invoke provider effect
  -> settle the named operation as confirmed, ambiguous, rejected, or cancelled
```

Recovery treats an `effect-started` record without a terminal outcome as ambiguous, even if the provider call may not have left the process. A driver may settle it as `cancelled` only when it can positively establish that the requested effect did not occur. Otherwise it remains ambiguous and requires reconciliation. That conservative rule closes the crash window around the side effect.

Reusing an attempt ID is idempotent only when its operation, source, and fingerprint match the durable record. A different fingerprint is an explicit collision and must fail closed. A journal is parameterized by a discriminated definition union so each operation stays correlated with its recovery metadata and resolution type through settlement.

Use an opaque identifier or a keyed digest for the fingerprint. A plain hash of low-entropy user input remains guessable and sensitive. Never store raw user input, secrets, or provider payloads in the field.

SQLite and Convex implementations can satisfy the same ports. They should store reviewed application bindings, attempts, cursors, and projections. They should not receive a generic `saveSnapshot` method or automatically persist provider credentials, raw protocol payloads, paths, tool arguments, or transcripts.

Read [docs/architecture.md](./docs/architecture.md) for the full boundary and recovery model.

## Development

```sh
bun install
bun run check
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidance and [SECURITY.md](./SECURITY.md) for private vulnerability reporting.

## License

MIT
