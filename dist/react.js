// src/react.ts
import {
  useDebugValue,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore
} from "react";
function objectIs(left, right) {
  return Object.is(left, right);
}
function createExternalStoreSelectorReader(getSnapshot, selector, isEqual = objectIs, getCommittedSelection = null) {
  let initialized = false;
  let previousSnapshot;
  let previousSelection;
  return () => {
    const snapshot = getSnapshot();
    if (initialized && Object.is(snapshot, previousSnapshot)) {
      return previousSelection;
    }
    const selection = selector(snapshot);
    if (!initialized) {
      initialized = true;
      previousSnapshot = snapshot;
      const committed = getCommittedSelection?.();
      if (committed?.hasValue === true && isEqual(committed.value, selection)) {
        previousSelection = committed.value;
        return previousSelection;
      }
      previousSelection = selection;
      return selection;
    }
    previousSnapshot = snapshot;
    if (isEqual(previousSelection, selection))
      return previousSelection;
    previousSelection = selection;
    return selection;
  };
}
function useExternalStoreSelector(store, selector, options = {}) {
  const [committed] = useState(() => ({
    current: { hasValue: false }
  }));
  const isEqual = options.isEqual ?? objectIs;
  const getServerSnapshot = options.getServerSnapshot ?? store.getSnapshot;
  const [getSelection, getServerSelection] = useMemo(() => [
    createExternalStoreSelectorReader(store.getSnapshot, selector, isEqual, () => committed.current),
    createExternalStoreSelectorReader(getServerSnapshot, selector, isEqual, () => committed.current)
  ], [committed, getServerSnapshot, isEqual, selector, store.getSnapshot]);
  const selection = useSyncExternalStore(store.subscribe, getSelection, getServerSelection);
  useEffect(() => {
    committed.current = { hasValue: true, value: selection };
  }, [committed, selection]);
  useDebugValue(selection);
  return selection;
}
export {
  useExternalStoreSelector,
  createExternalStoreSelectorReader
};
