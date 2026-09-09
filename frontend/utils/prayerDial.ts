import type { PrayerTime } from "@/services/prayerTimes";

import { lightAt, mixColors, skyAt, starLevel, sunAltitude } from "./sky";

/**
 * A 24 hour dial. Noon sits at the top, midnight at the bottom, and every
 * marker lands at its true angular time, so the long stretch between Sunrise
 * and Dhuhr finally looks as long as it is.
 */
export const DIAL = {
  size: 300,
  cx: 150,
  cy: 150,
  ringRadius: 110,
  ringWidth: 13,
  discRadius: 96,
} as const;

/**
 * One segment per four minutes. At this radius each segment is ~1.9 viewBox
 * units, which reads as continuous colour; going finer costs Path nodes for
 * sub-pixel detail nobody can see.
 */
export const RING_SEGMENTS = 360;

/** Prayers that get a marker and a column. Sunrise is a notch, not a prayer. */
export const DIAL_PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;
export type DialPrayer = (typeof DIAL_PRAYERS)[number];

const RAD = Math.PI / 180;

/** Minutes past local midnight, fractional. */
export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

/** Angle on the dial for a time of day. 0 is noon at the top, clockwise. */
export function angleForMinutes(minutes: number): number {
  return ((minutes - 720) / 1440) * 360;
}

export function pointOnRing(angle: number, radius: number = DIAL.ringRadius): { x: number; y: number } {
  return {
    x: DIAL.cx + radius * Math.sin(angle * RAD),
    y: DIAL.cy - radius * Math.cos(angle * RAD),
  };
}

function arcPath(a0: number, a1: number, radius: number): string {
  const p0 = pointOnRing(a0, radius);
  const p1 = pointOnRing(a1, radius);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
}

export type RingSegment = { d: string; c: string; end: number };

/**
 * The day's light as a wheel: one arc per slice of the day, coloured by the
 * sun's altitude at that moment.
 *
 * Depends only on the date and the location, never on the current time, so a
 * caller can build it once per day and reuse it across ticks.
 */
export function buildRing(
  date: Date,
  latitude: number,
  longitude: number,
  segments = RING_SEGMENTS,
): RingSegment[] {
  const step = 1440 / segments;
  // Overlap neighbours slightly so no seam shows. Scaled to the segment size:
  // a fixed overlap turns into heavy overdraw once the count goes up.
  const overlap = 0.6 * (360 / segments);
  const midnight = new Date(date);
  midnight.setHours(0, 0, 0, 0);

  const out: RingSegment[] = [];
  for (let i = 0; i < segments; i++) {
    const start = i * step;
    const end = start + step;
    const at = new Date(midnight.getTime() + (start + step / 2) * 60000);
    out.push({
      d: arcPath(angleForMinutes(start) - overlap, angleForMinutes(end) + overlap, DIAL.ringRadius),
      c: lightAt(sunAltitude(at, latitude, longitude)),
      end,
    });
  }
  return out;
}

/**
 * How present each part of the ring is: 1 is the day as lived, DIM is the part
 * still to come.
 *
 * The ring is a loop but the day is a line, so the elapsed span has two ends,
 * and a hard step at either one reads as a rendering fault. Midnight gets a
 * long ease because nothing marks it; "now" gets a short one because the sun
 * sits there and a crisp terminus is the point.
 */
const DIM = 0.2;
const MIDNIGHT_EASE = 180;
const NOW_EASE = 15;

const smoothstep = (t: number) => {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
};

export function ringPresence(end: number, nowMinutes: number | null): number {
  if (nowMinutes == null) return 1;
  if (end > nowMinutes) return DIM;
  const fromMidnight = smoothstep(end / MIDNIGHT_EASE);
  const beforeNow = smoothstep((nowMinutes - end) / NOW_EASE);
  return DIM + (1 - DIM) * Math.min(fromMidnight, beforeNow);
}

/** Ring colour faded toward the backdrop by how present that moment is. */
export function ringColor(segment: RingSegment, nowMinutes: number | null, backdrop: string): string {
  return mixColors(backdrop, segment.c, ringPresence(segment.end, nowMinutes));
}

export type SkyStop = { offset: number; color: string; opacity: number };

/**
 * The sky right now, bottom of the disc to top: offset 0 is the horizon, 1 is
 * the zenith. The whole disc is sky; there is no half-lit cross section.
 */
export function discStops(sunAlt: number, steps = 20): SkyStop[] {
  const stops: SkyStop[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    stops.push({
      offset: t,
      color: skyAt(sunAlt, t * 90),
      // Denser air low down, thinner overhead, so the wash never flattens the
      // numerals sitting in the middle of the disc.
      opacity: 0.52 - 0.26 * Math.pow(t, 0.9),
    });
  }
  return stops;
}

export type Star = { x: number; y: number; r: number; o: number; bloom: boolean };

/**
 * A fixed scatter of stars over the disc, varied in size and brightness so it
 * does not read as a grid of identical dots. Generated once at module load and
 * kept clear of the centre type. `starLevel` scales their opacity by time.
 */
export const STARS: Star[] = (() => {
  let seed = 20260304;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const TEXT = { x0: 90, x1: 210, y0: 102, y1: 202 };
  const out: Star[] = [];
  for (let guard = 0; out.length < 26 && guard < 9000; guard++) {
    const a = rnd() * 360;
    const r = Math.sqrt(rnd()) * 90;
    const x = DIAL.cx + r * Math.sin(a * RAD);
    const y = DIAL.cy - r * Math.cos(a * RAD);
    if (x > TEXT.x0 && x < TEXT.x1 && y > TEXT.y0 && y < TEXT.y1) continue;
    if (out.some((s) => Math.hypot(s.x - x, s.y - y) < 15)) continue;
    const height = (DIAL.cy + DIAL.discRadius - y) / (2 * DIAL.discRadius);
    out.push({
      x: +x.toFixed(1),
      y: +y.toFixed(1),
      r: +(0.45 + rnd() * 0.8).toFixed(2),
      o: +((0.3 + rnd() * 0.45) * (0.45 + 0.55 * height)).toFixed(3),
      bloom: rnd() < 0.22,
    });
  }
  return out;
})();

export { starLevel, sunAltitude };

/** Parse "h:mm AM/PM" onto `baseDate`. Returns null on anything unreadable. */
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

export type DialMarker = {
  label: string;
  time: string | null;
  minutes: number | null;
  angle: number;
  point: { x: number; y: number };
  /** Sunrise is drawn as a small notch and carries no log state. */
  notch: boolean;
};

/** Marker positions for a day's prayer times, in dial order. */
export function dialMarkers(
  prayerTimes: Pick<PrayerTime, "label" | "time">[],
  date: Date,
): DialMarker[] {
  const byLabel = new Map(prayerTimes.map((p) => [p.label, p.time]));
  const order = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];

  return order.map((label, i) => {
    const time = byLabel.get(label) ?? null;
    const parsed = time ? parsePrayerTime(time, date) : null;
    // Fall back to an even spread so a partial day still draws something sane.
    const minutes = parsed ? minutesOfDay(parsed) : null;
    const angle = angleForMinutes(minutes ?? 300 + i * 180);
    return { label, time, minutes, angle, point: pointOnRing(angle), notch: label === "Sunrise" };
  });
}

/** Total daylight for a day, as "11 hr 33 min", or null if it cannot be known. */
export function daylightLabel(sunrise: number | null, sunset: number | null): string | null {
  if (sunrise == null || sunset == null || sunset <= sunrise) return null;
  const total = Math.round(sunset - sunrise);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h} hr ${m} min of daylight` : `${m} min of daylight`;
}
