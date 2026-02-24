import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getHolidayMapForYear, getHolidaysForYear } from "../services/holidayService";
import {
  computeRamadanEnd,
  findRamadanStart,
  getMissedFastDays,
  getRamadanPeriodSummary,
  isInRamadanWindow,
} from "../services/ramadanTracker";

function parseDateKey(dateStr: string): Date | null {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function useCalendarData(viewYear: number, viewMonth: number) {
  const [holidayMap, setHolidayMap] = useState<Record<string, string>>({});
  const [loadingHolidays, setLoadingHolidays] = useState(false);

  const [missedFastsMap, setMissedFastsMap] = useState<Record<string, boolean>>(
    {},
  );
  const [ramadanMonthActive, setRamadanMonthActive] = useState(false);
  const [ramadanStart, setRamadanStart] = useState<Date | null>(null);
  const [ramadanEnd, setRamadanEnd] = useState<Date | null>(null);

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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const map = await getMissedFastDays();
        if (mounted) setMissedFastsMap(map);

        const holidays = await getHolidaysForYear(viewYear);
        const startDate = findRamadanStart(holidays);

        if (startDate) {
          const endDate = computeRamadanEnd(startDate);
          const firstOfMonth = new Date(viewYear, viewMonth, 1);
          const lastOfMonth = new Date(viewYear, viewMonth + 1, 0);

          const monthInWindow =
            isInRamadanWindow(firstOfMonth, startDate, endDate) ||
            isInRamadanWindow(lastOfMonth, startDate, endDate);

          if (mounted) {
            setRamadanMonthActive(monthInWindow);
            setRamadanStart(startDate);
            setRamadanEnd(endDate);
          }
        } else if (mounted) {
          setRamadanMonthActive(false);
          setRamadanStart(null);
          setRamadanEnd(null);
        }
      } catch (e) {
        console.warn("Failed to load Ramadan data:", e);
        if (mounted) {
          setMissedFastsMap({});
          setRamadanMonthActive(false);
          setRamadanStart(null);
          setRamadanEnd(null);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [viewMonth, viewYear]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const map = await getMissedFastDays();
          setMissedFastsMap(map);
        } catch (e) {
          console.warn("Failed to reload Ramadan map on focus:", e);
        }
      })();
    }, []),
  );

  const ramadanSummary = useMemo(() => {
    if (!ramadanMonthActive || !ramadanStart || !ramadanEnd) return null;
    return getRamadanPeriodSummary(missedFastsMap, ramadanStart, ramadanEnd);
  }, [missedFastsMap, ramadanEnd, ramadanMonthActive, ramadanStart]);

  const firstMissedFastDate = useMemo(() => {
    if (!ramadanMonthActive || !ramadanStart || !ramadanEnd) return null;

    const windowStart = new Date(ramadanStart);
    windowStart.setDate(windowStart.getDate() - 3);
    windowStart.setHours(0, 0, 0, 0);

    const windowEnd = new Date(ramadanEnd);
    windowEnd.setDate(windowEnd.getDate() + 3);
    windowEnd.setHours(0, 0, 0, 0);

    const earliestDateKey = Object.entries(missedFastsMap)
      .filter(([, isMissed]) => isMissed)
      .map(([dateKey]) => dateKey)
      .sort()
      .find((dateKey) => {
        const parsed = parseDateKey(dateKey);
        if (!parsed) return false;
        parsed.setHours(0, 0, 0, 0);
        return parsed >= windowStart && parsed <= windowEnd;
      });

    return earliestDateKey ? parseDateKey(earliestDateKey) : null;
  }, [missedFastsMap, ramadanEnd, ramadanMonthActive, ramadanStart]);

  const missedDaysLabel = useMemo(() => {
    if (!ramadanSummary || ramadanSummary.missedDays.length === 0) return "";
    return ramadanSummary.missedDays.join(", ");
  }, [ramadanSummary]);

  const showRamadanSummary =
    !!ramadanSummary && ramadanSummary.totalMissed > 0 && !!firstMissedFastDate;

  return {
    holidayMap,
    loadingHolidays,
    missedFastsMap,
    ramadanMonthActive,
    ramadanStart,
    ramadanEnd,
    ramadanSummary,
    firstMissedFastDate,
    missedDaysLabel,
    showRamadanSummary,
  };
}
