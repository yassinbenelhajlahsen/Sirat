import { useEffect, useState } from "react";

import type { SyncedSetting } from "@/services/syncedSettings";

/** Live value of a synced setting: loads once, then follows local edits and syncs from other devices. */
export function useSyncedSetting<T>(setting: SyncedSetting<T>): { value: T; loaded: boolean } {
  const [value, setValue] = useState<T>(() => setting.peek());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const unsubscribe = setting.subscribe((next) => {
      if (active) setValue(next);
    });
    void setting.get().then((next) => {
      if (!active) return;
      setValue(next);
      setLoaded(true);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [setting]);

  return { value, loaded };
}
