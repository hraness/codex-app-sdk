// src/client.ts
var MAX_ATTEMPT_ID_LENGTH = 200;
var ATTEMPT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
function isAttemptId(value) {
  return value.length > 0 && value.length <= MAX_ATTEMPT_ID_LENGTH && ATTEMPT_ID_PATTERN.test(value);
}
function createAttemptId(value) {
  if (!isAttemptId(value)) {
    throw new RangeError(`attempt ID must contain 1 to ${String(MAX_ATTEMPT_ID_LENGTH)} portable identifier characters`);
  }
  return value;
}
function confirmed(attemptId, value) {
  return Object.freeze({ status: "confirmed", attemptId, value });
}
function ambiguous(attemptId, reconciliation) {
  return Object.freeze({
    status: "ambiguous",
    attemptId,
    reconciliation: Object.freeze({
      ...reconciliation,
      strategy: Object.freeze({ ...reconciliation.strategy })
    })
  });
}
function rejected(attemptId, error) {
  return Object.freeze({
    status: "rejected",
    attemptId,
    error: Object.freeze({
      ...error,
      metadata: Object.freeze({ ...error.metadata ?? {} })
    })
  });
}
function cancelled(attemptId, reason) {
  return Object.freeze({ status: "cancelled", attemptId, reason });
}

// src/lifecycle.ts
class GenerationStoreContractError extends Error {
  constructor(message) {
    super(message);
    this.name = "GenerationStoreContractError";
  }
}
function assertGeneration(value, field = "generation") {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative safe integer`);
  }
}
function createGenerationFence(initialGeneration = 0) {
  assertGeneration(initialGeneration, "initial generation");
  let generation = initialGeneration;
  const current = () => generation;
  const isCurrent = (candidate) => candidate === generation;
  const advance = (minimumExclusive = generation) => {
    assertGeneration(minimumExclusive, "minimum generation");
    const floor = Math.max(generation, minimumExclusive);
    if (floor === Number.MAX_SAFE_INTEGER) {
      throw new RangeError("generation space is exhausted");
    }
    generation = floor + 1;
    return generation;
  };
  return Object.freeze({ advance, current, isCurrent });
}
async function reserveMonotonicGeneration(store, scope, minimumExclusive) {
  if (scope.length === 0 || scope.length > 512) {
    throw new RangeError("generation scope must contain 1 to 512 characters");
  }
  assertGeneration(minimumExclusive, "minimum generation");
  const generation = await store.reserve(scope, minimumExclusive);
  try {
    assertGeneration(generation, "reserved generation");
  } catch {
    throw new GenerationStoreContractError("generation store returned an invalid generation");
  }
  if (generation <= minimumExclusive) {
    throw new GenerationStoreContractError("generation store did not advance beyond the requested floor");
  }
  return generation;
}

// src/store.ts
function objectIs(left, right) {
  return Object.is(left, right);
}
function createReducerStore(initialSnapshot, reducer, options = {}) {
  let snapshot = initialSnapshot;
  const subscriptions = new Set;
  const isEqual = options.isEqual ?? objectIs;
  const getSnapshot = () => snapshot;
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
  const reportListenerFailure = (error) => {
    try {
      options.onListenerFailure?.(Object.freeze({ error }));
    } catch {}
  };
  const dispatch = (action) => {
    const nextSnapshot = reducer(snapshot, action);
    if (isEqual(snapshot, nextSnapshot)) {
      return Object.freeze({
        changed: false,
        snapshot,
        listenerFailureCount: 0
      });
    }
    snapshot = nextSnapshot;
    let listenerFailureCount = 0;
    const committedSubscriptions = [...subscriptions];
    for (const subscription of committedSubscriptions) {
      try {
        subscription.listener();
      } catch (error) {
        listenerFailureCount += 1;
        reportListenerFailure(error);
      }
    }
    return Object.freeze({
      changed: true,
      snapshot,
      listenerFailureCount
    });
  };
  return Object.freeze({ dispatch, getSnapshot, subscribe });
}

// src/coordinates.ts
var MAX_SOURCE_ID_LENGTH = 512;
var SOURCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/@+=-]*$/u;
function assertNaturalNumber(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative safe integer`);
  }
}
function assertSourceId(sourceId) {
  if (sourceId.length === 0 || sourceId.length > MAX_SOURCE_ID_LENGTH || !SOURCE_ID_PATTERN.test(sourceId)) {
    throw new RangeError(`sourceId must contain 1 to ${String(MAX_SOURCE_ID_LENGTH)} portable identifier characters`);
  }
}
function createSourceCoordinate(coordinate) {
  assertSourceId(coordinate.sourceId);
  assertNaturalNumber(coordinate.generation, "generation");
  assertNaturalNumber(coordinate.sequence, "sequence");
  assertNaturalNumber(coordinate.index, "index");
  return Object.freeze({ ...coordinate });
}
function compareSourceCoordinates(left, right) {
  if (left.sourceId !== right.sourceId)
    return "different-source";
  const fields = ["generation", "sequence", "index"];
  for (const field of fields) {
    if (left[field] < right[field])
      return "before";
    if (left[field] > right[field])
      return "after";
  }
  return "equal";
}
function isSourceCoordinateCurrent(candidate, floor) {
  const relation = compareSourceCoordinates(candidate, floor);
  return relation === "equal" || relation === "after";
}

// src/persistence.ts
var MAX_MUTATION_FINGERPRINT_LENGTH = 512;
var MUTATION_FINGERPRINT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
function isMutationFingerprint(value) {
  return value.length > 0 && value.length <= MAX_MUTATION_FINGERPRINT_LENGTH && MUTATION_FINGERPRINT_PATTERN.test(value);
}
function createMutationFingerprint(value) {
  if (!isMutationFingerprint(value)) {
    throw new RangeError(`mutation fingerprint must contain 1 to ${String(MAX_MUTATION_FINGERPRINT_LENGTH)} portable identifier characters`);
  }
  return value;
}

export { isAttemptId, createAttemptId, confirmed, ambiguous, rejected, cancelled, GenerationStoreContractError, assertGeneration, createGenerationFence, reserveMonotonicGeneration, createReducerStore, createSourceCoordinate, compareSourceCoordinates, isSourceCoordinateCurrent, isMutationFingerprint, createMutationFingerprint };
