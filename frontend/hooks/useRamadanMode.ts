import { useCallback, useSyncExternalStore } from "react";

import { useSyncedSetting } from "@/hooks/useSyncedSetting";
import { ramadanModeSetting } from "@/services/syncedSettings";
import { isMissedFastDay, subscribePretendRamadan } from "@/utils/hijriDate";

/** Ramadan mode on/off (default on). Also follows changes synced in from another device. */
export function useRamadanMode() {
  const { value: ramadanMode } = useSyncedSetting(ramadanModeSetting);
  const setRamadanMode = useCallback(async (value: boolean) => {
    await ramadanModeSetting.set(value);
  }, []);
  return { ramadanMode, setRamadanMode };
}

/**
 * Whether today is in Ramadan or the 3 days either side, the same window the Calendar uses for
 * marking missed fasts. Follows the dev "Pretend it's Ramadan" switch.
 */
export function useIsRamadanSeason(): boolean {
  return useSyncExternalStore(subscribePretendRamadan, () => isMissedFastDay(new Date()));
}
