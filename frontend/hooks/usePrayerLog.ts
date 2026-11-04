import { useCallback } from "react";

import { useTrackerData } from "@/hooks/useTrackerData";
import {
  clearPrayerStatus,
  prayerLogStore,
  setPrayerStatus,
  type PrayerName,
  type PrayerStatus,
} from "@/services/prayerTracker";

type DayStatuses = Partial<Record<PrayerName, PrayerStatus>>;

const NONE: DayStatuses = {};

export function usePrayerLog(dateKey: string) {
  const statuses = useTrackerData(
    prayerLogStore,
    (log) => {
      const out: DayStatuses = {};
      for (const [prayer, cell] of Object.entries(log[dateKey] ?? {})) {
        if (cell?.value) out[prayer as PrayerName] = cell.value;
      }
      return out;
    },
    NONE,
    dateKey,
  );

  const setStatus = useCallback(
    (p: PrayerName, s: PrayerStatus) => setPrayerStatus(dateKey, p, s),
    [dateKey],
  );
  const clearStatus = useCallback(
    (p: PrayerName) => clearPrayerStatus(dateKey, p),
    [dateKey],
  );

  return { statuses, setStatus, clearStatus };
}
