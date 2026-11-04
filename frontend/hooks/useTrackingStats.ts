import { useTrackerData } from "@/hooks/useTrackerData";
import {
  monthDailyScores,
  monthlyCompletion,
  prayerStreak,
  qadaCount,
  prayerLogStore,
  unwrapPrayerLog,
  type PrayerLog,
  type PrayerName,
} from "@/services/prayerTracker";
import { dateKeyFromDate } from "@/services/holidayService";

export type TrackingStats = {
  streak: number;
  completion: { overall: number; byPrayer: Record<PrayerName, number> };
  qada: number;
  dailyScores: number[];
  year: number;
  monthIndex0: number;
};

function computeStats(log: PrayerLog): TrackingStats {
  const byDay = unwrapPrayerLog(log);
  const now = new Date();
  const todayKey = dateKeyFromDate(now);
  const year = now.getFullYear();
  const monthIndex0 = now.getMonth();
  return {
    streak: prayerStreak(byDay, todayKey),
    completion: monthlyCompletion(byDay, year, monthIndex0),
    qada: qadaCount(byDay),
    dailyScores: monthDailyScores(byDay, year, monthIndex0),
    year,
    monthIndex0,
  };
}

export function useTrackingStats(): TrackingStats | null {
  return useTrackerData<PrayerLog, TrackingStats | null>(prayerLogStore, computeStats, null);
}
