import { useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native";

import {
  PRAYER_LOG_UPDATED_EVENT,
  getPrayerLog,
  monthDailyScores,
  monthlyCompletion,
  prayerStreak,
  qadaCount,
  unwrapPrayerLog,
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

export function useTrackingStats(): TrackingStats | null {
  const [stats, setStats] = useState<TrackingStats | null>(null);

  useEffect(() => {
    let mounted = true;
    const reload = () => {
      getPrayerLog().then((log) => {
        if (!mounted) return;
        const byDay = unwrapPrayerLog(log);
        const now = new Date();
        const todayKey = dateKeyFromDate(now);
        const year = now.getFullYear();
        const monthIndex0 = now.getMonth();
        setStats({
          streak: prayerStreak(byDay, todayKey),
          completion: monthlyCompletion(byDay, year, monthIndex0),
          qada: qadaCount(byDay),
          dailyScores: monthDailyScores(byDay, year, monthIndex0),
          year,
          monthIndex0,
        });
      });
    };
    reload();
    const sub = DeviceEventEmitter.addListener(PRAYER_LOG_UPDATED_EVENT, reload);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return stats;
}
