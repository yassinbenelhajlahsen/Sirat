import { useCallback } from "react";
import { useSyncedSetting } from "@/hooks/useSyncedSetting";
import { ramadanTrackerSetting } from "@/services/syncedSettings";
import { dateKeyFromDate } from "@/utils/dateKey";
import { isMissedFastDay } from "@/utils/hijriDate";
import { clearMissedFast, markFastAsMissed } from "../services/ramadanTracker";

export function useRamadanTracker(selectedDate: Date | null) {
  const { value: missedFastsMap } = useSyncedSetting(ramadanTrackerSetting);

  const isRamadan = !!selectedDate && isMissedFastDay(selectedDate);
  const isFastMissed = isRamadan && missedFastsMap[dateKeyFromDate(selectedDate)] === true;

  const toggleMissedFast = useCallback(async () => {
    if (!selectedDate) return;
    try {
      if (isFastMissed) await clearMissedFast(selectedDate);
      else await markFastAsMissed(selectedDate);
    } catch (e) {
      console.error("Failed to update missed fast status:", e);
    }
  }, [isFastMissed, selectedDate]);

  return { isRamadan, isFastMissed, toggleMissedFast };
}
