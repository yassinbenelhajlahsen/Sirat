import { useCallback } from "react";

import { useTrackerData } from "@/hooks/useTrackerData";
import {
  clearPrayerStatus,
  prayerLogStore,
  setPrayerStatus,
  type PrayerName,
  type PrayerStatus,
} from "@/services/prayerTracker";
import { unwrapDay } from "@/services/tracking/stats";

type DayStatuses = Partial<Record<PrayerName, PrayerStatus>>;

const NONE: DayStatuses = {};

export function usePrayerLog(dateKey: string) {
  const statuses = useTrackerData(
    prayerLogStore,
    (log) => unwrapDay(log[dateKey]),
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
