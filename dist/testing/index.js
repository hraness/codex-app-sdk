import {
  assertGeneration,
  cancelled,
  createAttemptId,
  createReducerStore,
  createSourceCoordinate,
  isAttemptId,
  isMutationFingerprint
} from "../index-xwmy0jrr.js";

// src/testing/fixtures.ts
function createDeterministicNumberSource(seed) {
  if (!Number.isSafeInteger(seed)) {
    throw new RangeError("seed must be a safe integer");
  }
  let state = seed >>> 0;
  const nextUint32 = () => {
    state = state + 1831565813 >>> 0;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return (value ^ value >>> 14) >>> 0;
  };
  const nextInteger = (minimumInclusive, maximumInclusive) => {
    if (!Number.isSafeInteger(minimumInclusive) || !Number.isSafeInteger(maximumInclusive) || minimumInclusive > maximumInclusive) {
      throw new RangeError("integer bounds are invalid");
    }
    const width = maximumInclusive - minimumInclusive + 1;
    if (!Number.isSafeInteger(width) || width < 1 || width > 4294967296) {
      throw new RangeError("integer range must fit within 32 bits");
    }
    return minimumInclusive + nextUint32() % width;
  };
  return Object.freeze({ nextInteger, nextUint32 });
}
function attemptIdFixture(index, prefix = "attempt") {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new RangeError("fixture index must be a non-negative safe integer");
  }
  return createAttemptId(`${prefix}-${String(index).padStart(6, "0")}`);
}
function sourceCoordinateFixture(overrides = {}) {
  return createSourceCoordinate({
    sourceId: overrides.sourceId ?? "source-fixture",
    generation: overrides.generation ?? 1,
    sequence: overrides.sequence ?? 0,
    index: overrides.index ?? 0
  });
}

// src/testing/memory-persistence.ts
var MAX_KEY_LENGTH = 512;
var MAX_PAGE_SIZE = 1000;
function assertKey(key, label) {
  if (key.length === 0 || key.length > MAX_KEY_LENGTH || key.trim() !== key) {
    throw new RangeError(`${label} must contain 1 to ${String(MAX_KEY_LENGTH)} characters`);
  }
}
function assertTimestamp(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
}
function assertRevision(value) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError("expected revision must be a positive safe integer");
  }
}
function assertLimit(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_PAGE_SIZE) {
    throw new RangeError(`limit must be an integer from 1 to ${String(MAX_PAGE_SIZE)}`);
  }
}
function comparePortableIdentifier(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
function present(revision, value) {
  return Object.freeze({ revision, state: "present", value });
}
function deleted(revision) {
  return Object.freeze({ revision, state: "deleted" });
}
function createMemoryConditionalStore(keyLabel) {
  const records = new Map;
  const get = (key) => {
    assertKey(key, keyLabel);
    return Promise.resolve(records.get(key) ?? null);
  };
  const matches = (current, expectedRevision) => {
    if (expectedRevision === null)
      return current === null;
    assertRevision(expectedRevision);
    return current?.revision === expectedRevision;
  };
  const set = (key, value, expectedRevision) => {
    assertKey(key, keyLabel);
    const current = records.get(key) ?? null;
    if (!matches(current, expectedRevision)) {
      return Promise.resolve(Object.freeze({ status: "conflict", current }));
    }
    const next = present((current?.revision ?? 0) + 1, value);
    records.set(key, next);
    return Promise.resolve(Object.freeze({ status: "applied", current: next }));
  };
  const deleteValue = (key, expectedRevision) => {
    assertKey(key, keyLabel);
    const current = records.get(key) ?? null;
    if (!matches(current, expectedRevision)) {
      return Promise.resolve(Object.freeze({ status: "conflict", current }));
    }
    const next = deleted((current?.revision ?? 0) + 1);
    records.set(key, next);
    return Promise.resolve(Object.freeze({ status: "applied", current: next }));
  };
  return Object.freeze({ delete: deleteValue, get, set });
}
function createMemoryBindingStore() {
  return createMemoryConditionalStore("binding key");
}
function createMemoryProjectionCheckpointStore() {
  return createMemoryConditionalStore("checkpoint key");
}
function freezePrepared(draft) {
  return Object.freeze({
    state: "prepared",
    revision: 1,
    attemptId: draft.attemptId,
    fingerprint: draft.fingerprint,
    operation: draft.operation,
    sourceId: draft.sourceId,
    preparedAtMs: draft.preparedAtMs,
    recovery: draft.recovery
  });
}
function validSettlementTransition(current, settlement) {
  if (current.state === "settled")
    return false;
  if (current.operation !== settlement.operation || settlement.outcome.attemptId !== settlement.attemptId) {
    return false;
  }
  if (current.state === "prepared") {
    return settlement.outcome.status === "cancelled" || settlement.outcome.status === "rejected";
  }
  return true;
}
function createMemoryMutationAttemptJournal() {
  const attempts = new Map;
  const prepare = (draft) => {
    if (!isMutationFingerprint(draft.fingerprint)) {
      throw new RangeError("mutation fingerprint is invalid");
    }
    assertKey(draft.operation, "operation");
    assertKey(draft.sourceId, "source ID");
    assertTimestamp(draft.preparedAtMs, "preparedAtMs");
    const existing = attempts.get(draft.attemptId);
    if (existing !== undefined) {
      if (existing.fingerprint !== draft.fingerprint || existing.operation !== draft.operation || existing.sourceId !== draft.sourceId) {
        return Promise.resolve(Object.freeze({ status: "collision", current: existing }));
      }
      return Promise.resolve(Object.freeze({ status: "existing", record: existing }));
    }
    const record = freezePrepared(draft);
    attempts.set(draft.attemptId, record);
    return Promise.resolve(Object.freeze({ status: "created", record }));
  };
  const markEffectStarted = (attemptId, expectedRevision, effectStartedAtMs) => {
    assertRevision(expectedRevision);
    assertTimestamp(effectStartedAtMs, "effectStartedAtMs");
    const current = attempts.get(attemptId);
    if (current === undefined) {
      return Promise.resolve(Object.freeze({ status: "missing" }));
    }
    if (current.revision !== expectedRevision) {
      return Promise.resolve(Object.freeze({ status: "conflict", current }));
    }
    if (current.state !== "prepared") {
      return Promise.resolve(Object.freeze({ status: "invalid-transition", current }));
    }
    if (effectStartedAtMs < current.preparedAtMs) {
      throw new RangeError("effectStartedAtMs cannot precede preparedAtMs");
    }
    const record = Object.freeze({
      state: "effect-started",
      revision: current.revision + 1,
      attemptId: current.attemptId,
      fingerprint: current.fingerprint,
      operation: current.operation,
      sourceId: current.sourceId,
      preparedAtMs: current.preparedAtMs,
      recovery: current.recovery,
      effectStartedAtMs
    });
    const storedRecord = record;
    attempts.set(attemptId, storedRecord);
    return Promise.resolve(Object.freeze({ status: "applied", record: storedRecord }));
  };
  const settle = (settlement) => {
    const {
      attemptId,
      expectedRevision,
      outcome,
      settledAtMs
    } = settlement;
    assertRevision(expectedRevision);
    assertTimestamp(settledAtMs, "settledAtMs");
    const current = attempts.get(attemptId);
    if (current === undefined) {
      return Promise.resolve(Object.freeze({ status: "missing" }));
    }
    if (current.revision !== expectedRevision) {
      return Promise.resolve(Object.freeze({ status: "conflict", current }));
    }
    if (!validSettlementTransition(current, settlement)) {
      return Promise.resolve(Object.freeze({ status: "invalid-transition", current }));
    }
    const earliestSettlement = current.state === "effect-started" ? current.effectStartedAtMs : current.preparedAtMs;
    if (settledAtMs < earliestSettlement) {
      throw new RangeError("settledAtMs cannot precede the attempt's current state");
    }
    const record = Object.freeze({
      state: "settled",
      revision: current.revision + 1,
      attemptId: current.attemptId,
      fingerprint: current.fingerprint,
      operation: current.operation,
      sourceId: current.sourceId,
      preparedAtMs: current.preparedAtMs,
      recovery: current.recovery,
      effectStartedAtMs: current.state === "effect-started" ? current.effectStartedAtMs : null,
      settledAtMs,
      outcome
    });
    const storedRecord = record;
    attempts.set(attemptId, storedRecord);
    return Promise.resolve(Object.freeze({ status: "applied", record: storedRecord }));
  };
  const get = (attemptId) => Promise.resolve(attempts.get(attemptId) ?? null);
  const listOpen = (request) => {
    assertLimit(request.limit);
    if (request.sourceId !== null) {
      assertKey(request.sourceId, "source ID");
    }
    if (request.after !== null) {
      assertTimestamp(request.after.preparedAtMs, "attempt cursor preparedAtMs");
      if (!isAttemptId(request.after.attemptId)) {
        throw new RangeError("attempt cursor ID is invalid");
      }
    }
    const records = [...attempts.values()].filter((record) => record.state !== "settled" && (request.sourceId === null || record.sourceId === request.sourceId)).sort((left, right) => {
      if (left.preparedAtMs !== right.preparedAtMs) {
        return left.preparedAtMs - right.preparedAtMs;
      }
      return comparePortableIdentifier(left.attemptId, right.attemptId);
    }).filter((record) => request.after === null || record.preparedAtMs > request.after.preparedAtMs || record.preparedAtMs === request.after.preparedAtMs && comparePortableIdentifier(record.attemptId, request.after.attemptId) > 0).slice(0, request.limit + 1);
    const hasMore = records.length > request.limit;
    const page = records.slice(0, request.limit);
    const last = page.at(-1);
    return Promise.resolve(Object.freeze({
      attempts: Object.freeze(page),
      nextCursor: last === undefined ? null : Object.freeze({
        preparedAtMs: last.preparedAtMs,
        attemptId: last.attemptId
      }),
      hasMore
    }));
  };
  return Object.freeze({
    get,
    listOpen,
    markEffectStarted,
    prepare,
    settle
  });
}
function createMemoryGenerationStore() {
  const generations = new Map;
  const read = (scope) => {
    assertKey(scope, "generation scope");
    return Promise.resolve(generations.get(scope) ?? null);
  };
  const reserve = (scope, minimumExclusive) => {
    assertKey(scope, "generation scope");
    assertGeneration(minimumExclusive, "minimum generation");
    const floor = Math.max(generations.get(scope) ?? 0, minimumExclusive);
    if (floor === Number.MAX_SAFE_INTEGER) {
      throw new RangeError("generation space is exhausted");
    }
    const generation = floor + 1;
    generations.set(scope, generation);
    return Promise.resolve(generation);
  };
  return Object.freeze({ read, reserve });
}
function createMemoryChangeFeed() {
  const entries = [];
  const subscriptions = new Set;
  let cursor = 0;
  const append = (change) => {
    if (cursor === Number.MAX_SAFE_INTEGER) {
      throw new RangeError("change-feed cursor space is exhausted");
    }
    cursor += 1;
    const entry = Object.freeze({ cursor, change });
    entries.push(entry);
    for (const subscription of [...subscriptions]) {
      try {
        subscription.listener();
      } catch {}
    }
    return entry;
  };
  const read = (request) => {
    assertLimit(request.limit);
    const after = request.after ?? 0;
    assertGeneration(after, "change-feed cursor");
    const available = entries.filter((entry) => entry.cursor > after);
    const pageEntries = available.slice(0, request.limit);
    const last = pageEntries.at(-1);
    return Promise.resolve(Object.freeze({
      entries: Object.freeze(pageEntries),
      nextCursor: last?.cursor ?? request.after,
      hasMore: available.length > pageEntries.length
    }));
  };
  const subscribe = (listener) => {
    const subscription = Object.freeze({ listener });
    subscriptions.add(subscription);
    let subscribed = true;
    return () => {
      if (!subscribed)
        return;
      subscribed = false;
      subscriptions.delete(subscription);
    };
  };
  return Object.freeze({ append, read, subscribe });
}

// src/testing/scripted-driver.ts
function applySnapshot(step, install) {
  if (step.snapshot !== undefined)
    install(step.snapshot);
}
function createScriptedCodexAppDriver(options) {
  const store = createReducerStore(options.initialSnapshot, (_snapshot, next) => next);
  const steps = [...options.steps];
  const recordedCalls = [];
  let started = false;
  let closed = false;
  const record = (call) => {
    recordedCalls.push(Object.freeze(call));
  };
  const assertAvailable = () => {
    if (!started || closed) {
      throw new Error("scripted driver is not running");
    }
  };
  const takeStep = () => {
    const step = steps.shift();
    if (step === undefined) {
      throw new Error("scripted driver received an unexpected call");
    }
    return step;
  };
  const start = (context) => {
    record({ call: "start", generation: context.generation });
    if (context.signal.aborted) {
      return Promise.reject(new Error("scripted start was cancelled"));
    }
    if (options.startFailure !== undefined) {
      return Promise.reject(options.startFailure);
    }
    started = true;
    return Promise.resolve();
  };
  const dispatch = (intent, context) => {
    assertAvailable();
    record({
      call: "dispatch",
      generation: context.generation,
      attemptId: intent.attemptId,
      type: intent.type
    });
    if (context.signal.aborted) {
      return Promise.resolve(cancelled(intent.attemptId, "client-closing"));
    }
    const step = takeStep();
    if (step.call !== "dispatch" || step.expectedType !== intent.type) {
      throw new Error("scripted dispatch did not match the next step");
    }
    applySnapshot(step, (snapshot) => {
      store.dispatch(snapshot);
    });
    return Promise.resolve(step.outcome);
  };
  const reconcile = (request, context) => {
    assertAvailable();
    record({
      call: "reconcile",
      generation: context.generation,
      attemptId: request.attemptId,
      operation: request.operation
    });
    if (context.signal.aborted) {
      return Promise.resolve(cancelled(request.attemptId, "client-closing"));
    }
    const step = takeStep();
    if (step.call !== "reconcile" || step.expectedOperation !== request.operation || step.expectedAttemptId !== request.attemptId) {
      throw new Error("scripted reconciliation did not match the next step");
    }
    applySnapshot(step, (snapshot) => {
      store.dispatch(snapshot);
    });
    return Promise.resolve(step.outcome);
  };
  const close = (context) => {
    record({ call: "close", generation: context.generation });
    closed = true;
    if (options.closeFailure !== undefined) {
      return Promise.reject(options.closeFailure);
    }
    return Promise.resolve();
  };
  return Object.freeze({
    store,
    start,
    dispatch,
    reconcile,
    close,
    calls: () => Object.freeze([...recordedCalls]),
    remainingSteps: () => steps.length
  });
}
export {
  sourceCoordinateFixture,
  createScriptedCodexAppDriver,
  createMemoryProjectionCheckpointStore,
  createMemoryMutationAttemptJournal,
  createMemoryGenerationStore,
  createMemoryChangeFeed,
  createMemoryBindingStore,
  createDeterministicNumberSource,
  attemptIdFixture
};
