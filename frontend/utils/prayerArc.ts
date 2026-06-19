import type { PrayerTime } from "@/services/prayerTimes";

// Canonical order of the six rows shown on the arc, left → right.
export const ARC_PRAYER_ORDER = [
  "Fajr",
  "Sunrise",
  "Dhuhr",
  "Asr",
  "Maghrib",
  "Isha",
] as const;
export type ArcPrayerLabel = (typeof ARC_PRAYER_ORDER)[number];

// Quadratic Bézier arc in a 300 × 118 viewBox. The control point is centred on
// x (so x is linear in t and the six points come out evenly spaced) and lifted
// in y to form the dome. Endpoints sit on the horizon line (y = 92).
export const ARC_VIEWBOX = { width: 300, height: 118 } as const;
const P0 = { x: 25, y: 92 };
const P1 = { x: 150, y: 2 };
const P2 = { x: 275, y: 92 };

export function arcPoint(t: number): { x: number; y: number } {
  const c = Math.max(0, Math.min(1, t));
  const u = 1 - c;
  return {
    x: u * u * P0.x + 2 * u * c * P1.x + c * c * P2.x,
    y: u * u * P0.y + 2 * u * c * P1.y + c * c * P2.y,
  };
}

// t for each prayer's slot, evenly spaced across the arc.
export function prayerSlotT(index: number): number {
  return index / (ARC_PRAYER_ORDER.length - 1);
}

// Arc length from t=0 up to tEnd, by sampling. Used to dash the gold
// "day-so-far" overlay so it ends exactly under the sun.
export function arcLength(tEnd = 1, steps = 64): number {
  const end = Math.max(0, Math.min(1, tEnd));
  let len = 0;
  let prev = arcPoint(0);
  for (let s = 1; s <= steps; s++) {
    const cur = arcPoint((end * s) / steps);
    len += Math.hypot(cur.x - prev.x, cur.y - prev.y);
    prev = cur;
  }
  return len;
}

export type PrayerState = "passed" | "next" | "upcoming";

export type ArcPrayer = {
  label: ArcPrayerLabel;
  time: string | null;
  t: number;
  point: { x: number; y: number };
  state: PrayerState;
};

export function prayerStates(
  prayerTimes: Pick<PrayerTime, "label" | "time">[],
  nextLabel: string | null,
): ArcPrayer[] {
  const byLabel = new Map(prayerTimes.map((p) => [p.label, p.time]));
  const nextIndex = nextLabel
    ? ARC_PRAYER_ORDER.indexOf(nextLabel as ArcPrayerLabel)
    : -1;

  return ARC_PRAYER_ORDER.map((label, index) => {
    let state: PrayerState;
    if (nextIndex === -1 || index < nextIndex) state = "passed";
    else if (index === nextIndex) state = "next";
    else state = "upcoming";

    const t = prayerSlotT(index);
    return { label, time: byLabel.get(label) ?? null, t, point: arcPoint(t), state };
  });
}

// Parse a "h:mm AM/PM" string into a Date on the given day. Mirrors the parser
// in useHomePrayerTimes; returns null on anything it can't read.
export function parsePrayerTime(timeStr: string, baseDate: Date): Date | null {
  if (!timeStr) return null;
  const [time, modifier] = timeStr.split(" ");
  if (!time) return null;
  const [hoursStr, minutesStr] = time.split(":");
  let hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (modifier === "PM" && hours !== 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;
  const d = new Date(baseDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export type SunMarker = { t: number; isNight: boolean };

// Where the sun/moon sits on the arc for `now`. Interpolates between the
// bounding prayer slots so it tracks real time. Night (moon) once the sun has
// set (≥ Maghrib) or before Fajr. Returns null if the timeline is incomplete.
export function sunMarker(
  prayerTimes: Pick<PrayerTime, "label" | "time">[],
  now: Date,
): SunMarker | null {
  const byLabel = new Map(prayerTimes.map((p) => [p.label, p.time]));
  const dates = ARC_PRAYER_ORDER.map((label) => {
    const raw = byLabel.get(label);
    return raw ? parsePrayerTime(raw, now) : null;
  });
  if (dates.some((d) => d === null)) return null;
  const t = dates as Date[];

  const fajr = t[0];
  const isha = t[t.length - 1];
  const maghrib = t[ARC_PRAYER_ORDER.indexOf("Maghrib")];

  if (now <= fajr) return { t: 0, isNight: true };
  if (now >= isha) return { t: 1, isNight: true };

  let i = 0;
  for (let k = 0; k < t.length - 1; k++) {
    if (now >= t[k] && now < t[k + 1]) {
      i = k;
      break;
    }
  }
  const frac =
    (now.getTime() - t[i].getTime()) / (t[i + 1].getTime() - t[i].getTime());
  const tt = prayerSlotT(i) + frac * (prayerSlotT(i + 1) - prayerSlotT(i));
  return { t: tt, isNight: now >= maghrib };
}
