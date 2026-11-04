import { useEffect, useMemo, useState } from "react";
import { useSyncedSetting } from "@/hooks/useSyncedSetting";
import { ramadanTrackerSetting } from "@/services/syncedSettings";
import { getHolidayMapForYear } from "../services/holidayService";
import { getRamadanPeriodSummary, missedFastsInPeriod } from "../services/ramadanTracker";
import { MISSED_FAST_BUFFER_DAYS, ramadanPeriod } from "@/utils/hijriDate";

function parseDateKey(dateStr: string): Date | null {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function useCalendarData(viewYear: number, viewMonth: number) {
  const [holidayMap, setHolidayMap] = useState<Record<string, string>>({});
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const { value: missedFastsMap } = useSyncedSetting(ramadanTrackerSetting);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingHolidays(true);
      try {
        const map = await getHolidayMapForYear(viewYear);
        if (mounted) setHolidayMap(map);
      } catch (err) {
        console.error("Failed to load holidays:", err);
        if (mounted) setHolidayMap({});
      } finally {
        if (mounted) setLoadingHolidays(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [viewYear]);

  const period = useMemo(() => ramadanPeriod(viewYear), [viewYear]);

  // The month shows the Ramadan section when it touches Ramadan or the days either side that can be marked.
  const ramadanMonthActive = useMemo(() => {
    if (!period) return false;
    const lastOfMonth = new Date(viewYear, viewMonth + 1, 0);
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const from = new Date(period.start.getFullYear(), period.start.getMonth(), period.start.getDate() - MISSED_FAST_BUFFER_DAYS);
    const to = new Date(period.end.getFullYear(), period.end.getMonth(), period.end.getDate() + MISSED_FAST_BUFFER_DAYS);
    return firstOfMonth <= to && lastOfMonth >= from;
  }, [period, viewMonth, viewYear]);

  const ramadanSummary = useMemo(
    () => (ramadanMonthActive && period ? getRamadanPeriodSummary(missedFastsMap, period) : null),
    [missedFastsMap, period, ramadanMonthActive],
  );

  const firstMissedFastDate = useMemo(() => {
    if (!ramadanMonthActive || !period) return null;
    const first = missedFastsInPeriod(missedFastsMap, period)[0];
    return first ? parseDateKey(first) : null;
  }, [missedFastsMap, period, ramadanMonthActive]);

  const missedDaysLabel = ramadanSummary?.missedDays.join(", ") ?? "";

  const showRamadanSummary =
    !!ramadanSummary && ramadanSummary.totalMissed > 0 && !!firstMissedFastDate;

  return {
    holidayMap,
    loadingHolidays,
    missedFastsMap,
    ramadanMonthActive,
    ramadanSummary,
    firstMissedFastDate,
    missedDaysLabel,
    showRamadanSummary,
  };
}
