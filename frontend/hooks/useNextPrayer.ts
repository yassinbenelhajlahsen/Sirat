import { useEffect, useMemo, useState } from "react";
import { nextSlot, type PrayerDay } from "../services/prayerDay";
import { dateKeyFromDate } from "@/utils/dateKey";
import getTimeUntil from "../utils/getTimeUntil";

/** The next prayer of today's day and a live countdown to it. Null for any other day. */
export function useNextPrayer(day: PrayerDay | null) {
  const [timeLeft, setTimeLeft] = useState("");
  const todayKey = dateKeyFromDate(new Date());

  const nextPrayer = useMemo(
    () => (day && day.dateKey === todayKey ? nextSlot(day, new Date()) : null),
    [day, todayKey],
  );

  useEffect(() => {
    if (!nextPrayer) {
      setTimeLeft("");
      return;
    }

    setTimeLeft(getTimeUntil(nextPrayer.at));
    const interval = setInterval(() => {
      setTimeLeft(getTimeUntil(nextPrayer.at));
    }, 1000);

    return () => clearInterval(interval);
  }, [nextPrayer]);

  return { nextPrayer, timeLeft };
}
