import { useEffect, useMemo, useState } from "react";
import { dateKeyFromDate } from "../services/holidayService";
import { PrayerTime } from "../services/prayerTimes";
import getTimeUntil from "../utils/getTimeUntil";

type NextPrayer = {
  label: string;
  time: string;
  dateObj: Date;
};

function parseTimeToDate(timeStr: string, baseDate: Date): Date {
  const [time, modifier] = timeStr.split(" ");
  const [hoursStr, minutesStr] = time.split(":");
  let hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  if (modifier === "PM" && hours !== 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;
  const dateObj = new Date(baseDate);
  dateObj.setHours(hours, minutes, 0, 0);
  return dateObj;
}

export function useNextPrayer(
  selectedDate: Date | null,
  prayerTimes: PrayerTime[],
  prayerTimesDateKey: string | null,
) {
  const [timeLeft, setTimeLeft] = useState("");
  const today = new Date();
  const isToday = selectedDate?.toDateString() === today.toDateString();

  const nextPrayer = useMemo<NextPrayer | null>(() => {
    if (!selectedDate || !isToday || prayerTimes.length === 0) {
      return null;
    }

    const selectedDateKey = dateKeyFromDate(selectedDate);
    if (prayerTimesDateKey !== selectedDateKey) {
      return null;
    }

    const now = new Date();
    return (
      prayerTimes
        .map(({ label, time }) => ({
          label,
          time,
          dateObj: parseTimeToDate(time, selectedDate),
        }))
        .find(({ dateObj }) => dateObj > now) ?? null
    );
  }, [isToday, prayerTimes, prayerTimesDateKey, selectedDate]);

  useEffect(() => {
    if (!nextPrayer) {
      setTimeLeft("");
      return;
    }

    setTimeLeft(getTimeUntil(nextPrayer.dateObj));
    const interval = setInterval(() => {
      setTimeLeft(getTimeUntil(nextPrayer.dateObj));
    }, 1000);

    return () => clearInterval(interval);
  }, [nextPrayer]);

  return { nextPrayer, timeLeft };
}
