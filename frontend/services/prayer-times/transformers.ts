import type { BackendCalendarDay, PrayerTime, RequiredTimingMap } from "./types";

export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatTo12Hour(time24: string): string {
  const clean = time24.split(" ")[0];
  const [hStr, mStr] = clean.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function mapTimingsToPrayerTimes(timings: RequiredTimingMap): PrayerTime[] {
  return [
    { label: "Fajr", time: formatTo12Hour(timings.Fajr) },
    { label: "Sunrise", time: formatTo12Hour(timings.Sunrise) },
    { label: "Dhuhr", time: formatTo12Hour(timings.Dhuhr) },
    { label: "Asr", time: formatTo12Hour(timings.Asr) },
    { label: "Maghrib", time: formatTo12Hour(timings.Maghrib) },
    { label: "Isha", time: formatTo12Hour(timings.Isha) },
  ];
}

export function mergeCalendarDayIntoStore(
  allTimes: Record<string, PrayerTime[]>,
  day: BackendCalendarDay,
) {
  const greg = day?.date?.gregorian?.date;
  if (!greg || !day.timings) return;

  const [dd, mm, yy] = greg.split("-").map((x: string) => parseInt(x, 10));
  const key = `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;

  allTimes[key] = mapTimingsToPrayerTimes(day.timings);
}
