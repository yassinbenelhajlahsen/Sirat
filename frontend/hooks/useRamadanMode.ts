import { useCallback } from "react";

import { useSyncedSetting } from "@/hooks/useSyncedSetting";
import { ramadanModeSetting } from "@/services/syncedSettings";

/** Ramadan mode on/off (default on). Also follows changes synced in from another device. */
export function useRamadanMode() {
  const { value: ramadanMode } = useSyncedSetting(ramadanModeSetting);
  const setRamadanMode = useCallback(async (value: boolean) => {
    await ramadanModeSetting.set(value);
  }, []);
  return { ramadanMode, setRamadanMode };
}
