import { useCallback, useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native";

import {
  PRAYER_LOG_UPDATED_EVENT,
  clearPrayerStatus,
  getDayStatuses,
  setPrayerStatus,
  type PrayerName,
  type PrayerStatus,
} from "@/services/prayerTracker";

type DayStatuses = Partial<Record<PrayerName, PrayerStatus>>;

export function usePrayerLog(dateKey: string) {
  const [statuses, setStatuses] = useState<DayStatuses>({});

  useEffect(() => {
    let mounted = true;
    const reload = () => {
      getDayStatuses(dateKey).then((s) => {
        if (mounted) setStatuses(s);
      });
    };
    reload();
    const sub = DeviceEventEmitter.addListener(
      PRAYER_LOG_UPDATED_EVENT,
      (payload: { dateKey?: string | null }) => {
        if (payload?.dateKey == null || payload.dateKey === dateKey) reload();
      },
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, [dateKey]);

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
