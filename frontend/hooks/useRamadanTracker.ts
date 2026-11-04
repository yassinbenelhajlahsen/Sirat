import { useCallback, useEffect, useMemo, useState } from "react";
import { useSyncedSetting } from "@/hooks/useSyncedSetting";
import { getHolidaysForYear } from "../services/holidayService";
import { ramadanTrackerSetting } from "@/services/syncedSettings";
import { dateKeyFromDate } from "@/utils/dateKey";
import {
  clearMissedFast,
  computeRamadanEnd,
  findRamadanStart,
  isInRamadanWindow,
  markFastAsMissed,
} from "../services/ramadanTracker";

type RamadanParam = string | string[] | undefined;

function paramToString(param: RamadanParam): string | null {
  if (typeof param === "string" && param.length > 0) return param;
  return null;
}

function safeDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function useRamadanTracker(
  selectedDate: Date | null,
  ramadanStartParam: RamadanParam,
  ramadanEndParam: RamadanParam,
) {
  const { value: missedFastsMap } = useSyncedSetting(ramadanTrackerSetting);
  const [isRamadan, setIsRamadan] = useState(false);
  const [loadingRamadan, setLoadingRamadan] = useState(false);

  const startParam = useMemo(() => paramToString(ramadanStartParam), [
    ramadanStartParam,
  ]);
  const endParam = useMemo(() => paramToString(ramadanEndParam), [
    ramadanEndParam,
  ]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!selectedDate) return;
      setLoadingRamadan(true);

      try {
        let ramadanStart = safeDate(startParam);
        let ramadanEnd = safeDate(endParam);

        if (!ramadanStart || !ramadanEnd) {
          const holidays = await getHolidaysForYear(selectedDate.getFullYear());
          ramadanStart = findRamadanStart(holidays);
          ramadanEnd = ramadanStart ? computeRamadanEnd(ramadanStart) : null;
        }

        if (ramadanStart && ramadanEnd) {
          const inWindow = isInRamadanWindow(
            selectedDate,
            ramadanStart,
            ramadanEnd,
          );
          if (mounted) setIsRamadan(inWindow);
        } else if (mounted) {
          setIsRamadan(false);
        }
      } catch (e) {
        console.warn("Failed to load Ramadan status:", e);
        if (mounted) setIsRamadan(false);
      } finally {
        if (mounted) setLoadingRamadan(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [endParam, selectedDate, startParam]);

  const isFastMissed =
    isRamadan && !!selectedDate && missedFastsMap[dateKeyFromDate(selectedDate)] === true;

  const toggleMissedFast = useCallback(async () => {
    if (!selectedDate) return;
    try {
      if (isFastMissed) await clearMissedFast(selectedDate);
      else await markFastAsMissed(selectedDate);
    } catch (e) {
      console.error("Failed to update missed fast status:", e);
    }
  }, [isFastMissed, selectedDate]);

  return {
    isRamadan,
    isFastMissed,
    loadingRamadan,
    toggleMissedFast,
  };
}
