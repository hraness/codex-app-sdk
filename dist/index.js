import {
  GenerationStoreContractError,
  ambiguous,
  assertGeneration,
  cancelled,
  compareSourceCoordinates,
  confirmed,
  createAttemptId,
  createGenerationFence,
  createMutationFingerprint,
  createReducerStore,
  createSourceCoordinate,
  isAttemptId,
  isMutationFingerprint,
  isSourceCoordinateCurrent,
  rejected,
  reserveMonotonicGeneration
} from "./index-xwmy0jrr.js";

// src/operations.ts
var MIN_OPERATION_TIMEOUT_MS = 1;
var MAX_OPERATION_TIMEOUT_MS = 600000;
function assertConcurrency(value) {
  if (value !== "parallel" && value !== "per-source" && value !== "per-thread" && value !== "global") {
    throw new TypeError("operation concurrency is invalid");
  }
}
function assertTimeout(timeoutMs) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < MIN_OPERATION_TIMEOUT_MS || timeoutMs > MAX_OPERATION_TIMEOUT_MS) {
    throw new RangeError(`operation timeout must be an integer from ${String(MIN_OPERATION_TIMEOUT_MS)} to ${String(MAX_OPERATION_TIMEOUT_MS)} milliseconds`);
  }
}
function isRecord(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}
function ownDataProperty(value, key, label) {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined || !("value" in descriptor)) {
    throw new TypeError(`${label} must be an own data property`);
  }
  return descriptor.value;
}
function copyReconciliation(value) {
  if (!isRecord(value)) {
    throw new TypeError("operation reconciliation must be an object");
  }
  const kind = ownDataProperty(value, "kind", "operation reconciliation kind");
  const strategy = ownDataProperty(value, "strategy", "operation reconciliation strategy");
  if (kind !== "automatic" && kind !== "manual" && kind !== "unsupported") {
    throw new TypeError("operation reconciliation kind is invalid");
  }
  if (typeof strategy !== "string" || strategy.length === 0 || strategy.length > 128 || !/^[A-Za-z][A-Za-z0-9._:-]*$/u.test(strategy)) {
    throw new TypeError("operation reconciliation strategy must be a portable identifier");
  }
  return Object.freeze({
    kind,
    strategy
  });
}
function copySemantics(value) {
  if (!isRecord(value)) {
    throw new TypeError("operation semantics must be an object");
  }
  const effect = ownDataProperty(value, "effect", "operation effect");
  const lostResponse = ownDataProperty(value, "lostResponse", "operation lost-response policy");
  const timeoutMs = ownDataProperty(value, "timeoutMs", "operation timeout");
  const concurrency = ownDataProperty(value, "concurrency", "operation concurrency");
  const reconciliation = ownDataProperty(value, "reconciliation", "operation reconciliation");
  assertConcurrency(concurrency);
  assertTimeout(timeoutMs);
  switch (effect) {
    case "read":
    case "idempotent-mutation": {
      if (lostResponse !== "safe-to-retry" || reconciliation !== "not-required") {
        throw new TypeError("read and idempotent operations must be safe to retry");
      }
      return Object.freeze({
        effect,
        lostResponse: "safe-to-retry",
        timeoutMs,
        concurrency,
        reconciliation: "not-required"
      });
    }
    case "non-idempotent-mutation": {
      if (lostResponse !== "ambiguous") {
        throw new TypeError("non-idempotent operations must treat lost responses as ambiguous");
      }
      return Object.freeze({
        effect: "non-idempotent-mutation",
        lostResponse: "ambiguous",
        timeoutMs,
        concurrency,
        reconciliation: copyReconciliation(reconciliation)
      });
    }
    default:
      throw new TypeError("operation effect is invalid");
  }
}
function defineOperation(semantics) {
  return Object.freeze({ semantics: copySemantics(semantics) });
}
function defineOperationRegistry(definitions) {
  if (!isRecord(definitions)) {
    throw new TypeError("operation registry definitions must be an object");
  }
  const names = Object.keys(definitions);
  if (names.length === 0) {
    throw new TypeError("an operation registry must define at least one operation");
  }
  const entries = names.map((name) => {
    if (!/^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u.test(name)) {
      throw new TypeError("operation names must be portable identifiers with 1 to 128 characters");
    }
    const definition = ownDataProperty(definitions, name, `operation ${name} definition`);
    if (!isRecord(definition)) {
      throw new TypeError(`operation ${name} is missing its definition`);
    }
    return [
      name,
      Object.freeze({
        name,
        semantics: copySemantics(ownDataProperty(definition, "semantics", `operation ${name} semantics`))
      })
    ];
  });
  return Object.freeze(Object.fromEntries(entries));
}
function snapshotOperationRegistry(registry) {
  if (!isRecord(registry)) {
    throw new TypeError("operation registry must be an object");
  }
  const names = Object.keys(registry);
  if (names.length === 0) {
    throw new TypeError("an operation registry must define at least one operation");
  }
  const entries = names.map((name) => {
    if (!/^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u.test(name)) {
      throw new TypeError("operation names must be portable identifiers with 1 to 128 characters");
    }
    const descriptor = ownDataProperty(registry, name, `operation ${name} descriptor`);
    if (!isRecord(descriptor)) {
      throw new TypeError(`operation ${name} is missing its descriptor`);
    }
    const descriptorName = ownDataProperty(descriptor, "name", `operation ${name} descriptor name`);
    const semantics = ownDataProperty(descriptor, "semantics", `operation ${name} descriptor semantics`);
    if (descriptorName !== name) {
      throw new TypeError(`operation descriptor ${name} must repeat its registry name`);
    }
    return [
      name,
      Object.freeze({
        name,
        semantics: copySemantics(semantics)
      })
    ];
  });
  return Object.freeze(Object.fromEntries(entries));
}

// src/client-host.ts
class ClientHostLifecycleError extends Error {
  failure;
  constructor(failure) {
    super(failure.message);
    this.name = "ClientHostLifecycleError";
    this.failure = failure;
  }
}
function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return Object.freeze({ promise, resolve, reject });
}
function combineSignals(hostSignal, callerSignal) {
  if (callerSignal === undefined) {
    return Object.freeze({
      signal: hostSignal,
      cancellationReason: () => hostSignal.aborted ? "client-closing" : null,
      dispose: () => {
        return;
      }
    });
  }
  const controller = new AbortController;
  let cancellationReason = null;
  const abort = (reason) => {
    if (cancellationReason === null)
      cancellationReason = reason;
    controller.abort();
  };
  const abortForHost = () => abort("client-closing");
  const abortForCaller = () => abort("caller");
  if (hostSignal.aborted || callerSignal.aborted) {
    abort(hostSignal.aborted ? "client-closing" : "caller");
    return Object.freeze({
      signal: controller.signal,
      cancellationReason: () => cancellationReason,
      dispose: () => {
        return;
      }
    });
  }
  hostSignal.addEventListener("abort", abortForHost, { once: true });
  callerSignal.addEventListener("abort", abortForCaller, { once: true });
  const dispose = () => {
    hostSignal.removeEventListener("abort", abortForHost);
    callerSignal.removeEventListener("abort", abortForCaller);
  };
  return Object.freeze({
    signal: controller.signal,
    cancellationReason: () => cancellationReason,
    dispose
  });
}
function defaultLifecycleFailure(phase) {
  return Object.freeze({
    code: phase === "start" ? "driver_start_failed" : "driver_close_failed",
    message: phase === "start" ? "The client driver failed to start." : "The client driver failed to close cleanly.",
    retryable: phase === "start"
  });
}
function startCancelledFailure() {
  return Object.freeze({
    code: "start_cancelled",
    message: "Client start was cancelled before it completed.",
    retryable: true
  });
}
function safeLifecycleFailure(error, phase, describe) {
  if (describe === undefined)
    return defaultLifecycleFailure(phase);
  try {
    const failure = describe(error, phase);
    return Object.freeze({ ...failure });
  } catch {
    return defaultLifecycleFailure(phase);
  }
}
function lifecycleSnapshot(snapshot) {
  return Object.freeze(snapshot);
}
function notRunningOutcome(attemptId, status) {
  return rejected(attemptId, {
    code: "client_not_running",
    message: "Start the client before sending a command.",
    retryable: status !== "closed" && status !== "closing",
    metadata: { lifecycleStatus: status }
  });
}
function isRecord2(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}
function ownDataProperty2(value, key) {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined) {
    return Object.freeze({ kind: "missing" });
  }
  if (!("value" in descriptor)) {
    return Object.freeze({ kind: "accessor" });
  }
  return Object.freeze({
    kind: "data",
    value: descriptor.value
  });
}
function commandEnvelope(value, operationKey) {
  if (!isRecord2(value))
    return null;
  const attemptProperty = ownDataProperty2(value, "attemptId");
  if (attemptProperty.kind !== "data" || typeof attemptProperty.value !== "string" || !isAttemptId(attemptProperty.value)) {
    return null;
  }
  const operationProperty = ownDataProperty2(value, operationKey);
  if (operationProperty.kind !== "data")
    return null;
  return Object.freeze({
    attemptId: attemptProperty.value,
    operation: operationProperty.value
  });
}
function invalidCommandEnvelope() {
  return Promise.reject(new TypeError("command envelopes require an own portable attempt ID and operation field"));
}
function runtimeOperation(operations, operation) {
  if (typeof operation !== "string" || !Object.prototype.hasOwnProperty.call(operations, operation)) {
    return null;
  }
  return operations[operation] ?? null;
}
function canReconcile(descriptor) {
  return descriptor.semantics.effect === "non-idempotent-mutation" && descriptor.semantics.reconciliation.kind !== "unsupported";
}
function invalidOperationOutcome(attemptId, code) {
  return rejected(attemptId, {
    code,
    message: code === "unknown_operation" ? "The operation is not declared by this client." : "The operation does not support client reconciliation.",
    retryable: false
  });
}
function driverFailureOutcome(attemptId, descriptor, reason) {
  if (descriptor.semantics.lostResponse === "safe-to-retry") {
    return rejected(attemptId, {
      code: "driver_contract_violation",
      message: "The operation driver failed without a confirmed response. Retrying this operation is safe.",
      retryable: true,
      metadata: {
        operation: descriptor.name,
        effect: descriptor.semantics.effect,
        lostResponse: descriptor.semantics.lostResponse
      }
    });
  }
  return ambiguous(attemptId, {
    operation: descriptor.name,
    strategy: descriptor.semantics.reconciliation,
    reason
  });
}
function normalizeMetadata(value) {
  if (!isRecord2(value))
    return null;
  const entries = [];
  for (const key of Object.keys(value)) {
    const property = ownDataProperty2(value, key);
    if (property.kind !== "data")
      return null;
    const entry = property.value;
    if (entry !== null && typeof entry !== "string" && typeof entry !== "boolean" && (typeof entry !== "number" || !Number.isFinite(entry))) {
      return null;
    }
    entries.push([key, entry]);
  }
  return Object.freeze(Object.fromEntries(entries));
}
function normalizeDriverOutcome(outcome, attemptId, descriptor, cancellationReason) {
  if (!isRecord2(outcome))
    return null;
  const statusProperty = ownDataProperty2(outcome, "status");
  const attemptProperty = ownDataProperty2(outcome, "attemptId");
  if (statusProperty.kind !== "data" || attemptProperty.kind !== "data" || attemptProperty.value !== attemptId) {
    return null;
  }
  switch (statusProperty.value) {
    case "confirmed": {
      const valueProperty = ownDataProperty2(outcome, "value");
      return valueProperty.kind === "data" ? confirmed(attemptId, valueProperty.value) : null;
    }
    case "cancelled": {
      const reasonProperty = ownDataProperty2(outcome, "reason");
      if (reasonProperty.kind !== "data" || reasonProperty.value !== "caller" && reasonProperty.value !== "client-closing" && reasonProperty.value !== "superseded") {
        return null;
      }
      if (cancellationReason !== null) {
        return cancelled(attemptId, cancellationReason);
      }
      return reasonProperty.value === "superseded" ? cancelled(attemptId, "superseded") : null;
    }
    case "rejected": {
      const errorProperty = ownDataProperty2(outcome, "error");
      if (errorProperty.kind !== "data")
        return null;
      const error = errorProperty.value;
      if (!isRecord2(error))
        return null;
      const codeProperty = ownDataProperty2(error, "code");
      const messageProperty = ownDataProperty2(error, "message");
      const retryableProperty = ownDataProperty2(error, "retryable");
      const metadataProperty = ownDataProperty2(error, "metadata");
      if (codeProperty.kind !== "data" || messageProperty.kind !== "data" || retryableProperty.kind !== "data" || typeof codeProperty.value !== "string" || typeof messageProperty.value !== "string" || typeof retryableProperty.value !== "boolean" || metadataProperty.kind === "accessor") {
        return null;
      }
      let metadata;
      if (metadataProperty.kind === "data" && metadataProperty.value !== undefined) {
        const normalized = normalizeMetadata(metadataProperty.value);
        if (normalized === null)
          return null;
        metadata = normalized;
      }
      return rejected(attemptId, {
        code: codeProperty.value,
        message: messageProperty.value,
        retryable: retryableProperty.value,
        ...metadata === undefined ? {} : { metadata }
      });
    }
    case "ambiguous": {
      if (descriptor.semantics.lostResponse !== "ambiguous")
        return null;
      const reconciliationProperty = ownDataProperty2(outcome, "reconciliation");
      if (reconciliationProperty.kind !== "data")
        return null;
      const reconciliation = reconciliationProperty.value;
      if (!isRecord2(reconciliation))
        return null;
      const operationProperty = ownDataProperty2(reconciliation, "operation");
      const reasonProperty = ownDataProperty2(reconciliation, "reason");
      const strategyProperty = ownDataProperty2(reconciliation, "strategy");
      if (operationProperty.kind !== "data" || reasonProperty.kind !== "data" || strategyProperty.kind !== "data" || operationProperty.value !== descriptor.name || reasonProperty.value !== "lost-response" && reasonProperty.value !== "interrupted" && reasonProperty.value !== "driver-contract-violation" && reasonProperty.value !== "reconciliation-failed" || !isRecord2(strategyProperty.value)) {
        return null;
      }
      const kindProperty = ownDataProperty2(strategyProperty.value, "kind");
      const strategyNameProperty = ownDataProperty2(strategyProperty.value, "strategy");
      if (kindProperty.kind !== "data" || strategyNameProperty.kind !== "data" || kindProperty.value !== descriptor.semantics.reconciliation.kind || strategyNameProperty.value !== descriptor.semantics.reconciliation.strategy) {
        return null;
      }
      return ambiguous(attemptId, {
        operation: descriptor.name,
        strategy: descriptor.semantics.reconciliation,
        reason: reasonProperty.value
      });
    }
    default:
      return null;
  }
}
function createCodexAppClientHost(operations, driver, options = {}) {
  const runtimeOperations = snapshotOperationRegistry(operations);
  const fence = createGenerationFence(options.initialGeneration ?? 0);
  const lifecycleStore = createReducerStore(lifecycleSnapshot({ status: "idle", generation: fence.current() }), (_snapshot, next) => next);
  const inFlight = new Set;
  let startPromise = null;
  let startToken = null;
  let closePromise = null;
  let sessionController = null;
  let closingRequested = false;
  const installLifecycle = (snapshot) => {
    lifecycleStore.dispatch(lifecycleSnapshot(snapshot));
  };
  const runStart = async (token, generation, combined) => {
    try {
      if (combined.signal.aborted || closingRequested) {
        const failure = startCancelledFailure();
        const current2 = lifecycleStore.getSnapshot();
        if (current2.status === "starting" && current2.generation === generation && !closingRequested) {
          sessionController?.abort();
          installLifecycle({
            status: "failed",
            generation,
            phase: "start",
            failure
          });
        }
        throw new ClientHostLifecycleError(failure);
      }
      try {
        await driver.start({ generation, signal: combined.signal });
      } catch (error) {
        const current2 = lifecycleStore.getSnapshot();
        const failure = error instanceof ClientHostLifecycleError || combined.signal.aborted || closingRequested || current2.status !== "starting" || current2.generation !== generation ? startCancelledFailure() : safeLifecycleFailure(error, "start", options.describeLifecycleFailure);
        if (current2.status === "starting" && current2.generation === generation && !closingRequested) {
          sessionController?.abort();
          installLifecycle({
            status: "failed",
            generation,
            phase: "start",
            failure
          });
        }
        throw new ClientHostLifecycleError(failure);
      }
      const current = lifecycleStore.getSnapshot();
      if (combined.signal.aborted || closingRequested || current.status !== "starting" || current.generation !== generation) {
        const failure = startCancelledFailure();
        if (current.status === "starting" && current.generation === generation && !closingRequested) {
          sessionController?.abort();
          installLifecycle({
            status: "failed",
            generation,
            phase: "start",
            failure
          });
        }
        throw new ClientHostLifecycleError(failure);
      }
      installLifecycle({ status: "running", generation });
    } finally {
      combined.dispose();
      if (startToken === token) {
        startToken = null;
        startPromise = null;
      }
    }
  };
  const start = (callOptions = {}) => {
    const current = lifecycleStore.getSnapshot();
    if (current.status === "running")
      return Promise.resolve();
    if (current.status === "starting" && startPromise !== null) {
      return startPromise;
    }
    if (current.status === "failed") {
      return Promise.reject(new ClientHostLifecycleError(current.failure));
    }
    if (closingRequested || current.status === "closing" || current.status === "closed") {
      return Promise.reject(new ClientHostLifecycleError({
        code: "client_closed",
        message: "A closed client cannot be started.",
        retryable: false
      }));
    }
    if (callOptions.signal?.aborted === true) {
      return Promise.reject(new ClientHostLifecycleError({
        code: "start_cancelled",
        message: "Client start was cancelled before it began.",
        retryable: true
      }));
    }
    const generation = fence.advance();
    sessionController = new AbortController;
    const combined = combineSignals(sessionController.signal, callOptions.signal);
    const token = {};
    const deferred = createDeferred();
    startToken = token;
    startPromise = deferred.promise;
    installLifecycle({ status: "starting", generation });
    runStart(token, generation, combined).then(deferred.resolve, deferred.reject);
    return deferred.promise;
  };
  const beginCommand = (attemptId, descriptor, callOptions, invoke, thrownReason) => {
    const lifecycle = lifecycleStore.getSnapshot();
    if (closingRequested || lifecycle.status === "closing" || lifecycle.status === "closed") {
      return Promise.resolve(cancelled(attemptId, "client-closing"));
    }
    if (callOptions.signal?.aborted === true) {
      return Promise.resolve(cancelled(attemptId, "caller"));
    }
    if (lifecycle.status !== "running" || sessionController === null) {
      return Promise.resolve(notRunningOutcome(attemptId, lifecycle.status));
    }
    const combined = combineSignals(sessionController.signal, callOptions.signal);
    if (combined.signal.aborted) {
      combined.dispose();
      return Promise.resolve(cancelled(attemptId, closingRequested ? "client-closing" : "caller"));
    }
    const run = async () => {
      try {
        const outcome = await invoke({
          generation: lifecycle.generation,
          signal: combined.signal
        });
        const normalized = normalizeDriverOutcome(outcome, attemptId, descriptor, combined.cancellationReason());
        if (normalized === null) {
          return driverFailureOutcome(attemptId, descriptor, "driver-contract-violation");
        }
        return normalized;
      } catch {
        return driverFailureOutcome(attemptId, descriptor, thrownReason);
      } finally {
        combined.dispose();
      }
    };
    const deferred = createDeferred();
    const pending = deferred.promise;
    inFlight.add(pending);
    pending.then(() => {
      inFlight.delete(pending);
    }, () => {
      inFlight.delete(pending);
    });
    run().then(deferred.resolve, deferred.reject);
    return pending;
  };
  const dispatch = (intent, callOptions = {}) => {
    const envelope = commandEnvelope(intent, "type");
    if (envelope === null)
      return invalidCommandEnvelope();
    const descriptor = runtimeOperation(runtimeOperations, envelope.operation);
    if (descriptor === null) {
      return Promise.resolve(invalidOperationOutcome(envelope.attemptId, "unknown_operation"));
    }
    return beginCommand(envelope.attemptId, descriptor, callOptions, (context) => driver.dispatch(intent, context), "driver-contract-violation");
  };
  const reconcile = (request, callOptions = {}) => {
    const envelope = commandEnvelope(request, "operation");
    if (envelope === null)
      return invalidCommandEnvelope();
    const descriptor = runtimeOperation(runtimeOperations, envelope.operation);
    if (descriptor === null) {
      return Promise.resolve(invalidOperationOutcome(envelope.attemptId, "unknown_operation"));
    }
    if (!canReconcile(descriptor)) {
      return Promise.resolve(invalidOperationOutcome(envelope.attemptId, "operation_reconciliation_unavailable"));
    }
    return beginCommand(envelope.attemptId, descriptor, callOptions, (context) => driver.reconcile(request, context), "reconciliation-failed");
  };
  const runClose = async (generation, pendingStart, pendingCommands) => {
    if (pendingStart !== null) {
      await Promise.allSettled([pendingStart]);
    }
    let failure = null;
    try {
      await driver.close({ generation });
    } catch (error) {
      failure = safeLifecycleFailure(error, "close", options.describeLifecycleFailure);
    }
    await Promise.allSettled(pendingCommands);
    sessionController = null;
    installLifecycle({ status: "closed", generation, failure });
    if (failure !== null)
      throw new ClientHostLifecycleError(failure);
  };
  const close = () => {
    if (closePromise !== null)
      return closePromise;
    const current = lifecycleStore.getSnapshot();
    if (current.status === "closed")
      return Promise.resolve();
    const generation = current.generation;
    const pendingStart = startPromise;
    const pendingCommands = [...inFlight];
    const deferred = createDeferred();
    closePromise = deferred.promise;
    closingRequested = true;
    sessionController?.abort();
    installLifecycle({ status: "closing", generation });
    runClose(generation, pendingStart, pendingCommands).then(deferred.resolve, deferred.reject);
    return deferred.promise;
  };
  return Object.freeze({
    store: driver.store,
    lifecycle: lifecycleStore,
    start,
    dispatch,
    reconcile,
    close
  });
}
export {
  reserveMonotonicGeneration,
  rejected,
  isSourceCoordinateCurrent,
  isMutationFingerprint,
  isAttemptId,
  defineOperationRegistry,
  defineOperation,
  createSourceCoordinate,
  createReducerStore,
  createMutationFingerprint,
  createGenerationFence,
  createCodexAppClientHost,
  createAttemptId,
  confirmed,
  compareSourceCoordinates,
  cancelled,
  assertGeneration,
  ambiguous,
  MIN_OPERATION_TIMEOUT_MS,
  MAX_OPERATION_TIMEOUT_MS,
  GenerationStoreContractError,
  ClientHostLifecycleError
};
