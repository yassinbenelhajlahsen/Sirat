import { useEffect, useRef, useState } from "react";

import type { TrackerStore } from "@/services/tracking/trackerStore";

/**
 * A view of a tracker store that reloads whenever it changes, locally or from sync.
 * Pass `dateKey` to ignore changes to other days; a change with no day (a sync) always reloads.
 */
export function useTrackerData<T, R>(
  store: TrackerStore<T>,
  select: (data: T) => R,
  initial: R,
  dateKey?: string,
): R {
  const [value, setValue] = useState<R>(initial);
  const selectRef = useRef(select);
  selectRef.current = select;

  useEffect(() => {
    let mounted = true;
    const reload = () => {
      void store.get().then((data) => {
        if (mounted) setValue(selectRef.current(data));
      });
    };
    reload();
    const unsubscribe = store.subscribe((change) => {
      if (dateKey === undefined || change.dateKey == null || change.dateKey === dateKey) reload();
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [store, dateKey]);

  return value;
}
