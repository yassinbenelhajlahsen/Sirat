import * as SunCalc from "suncalc";

/**
 * Colour of daylight, indexed by how high the sun is.
 *
 * These eleven keyframes are the whole palette: night, the three twilights, the
 * ember at the horizon, then low gold up to the near-white of a high sun. Both
 * the dial ring and the sky disc read from this one ramp, which is why they
 * always agree with each other.
 */
const KEYFRAMES: [alt: number, rgb: [number, number, number]][] = [
  [60, [255, 240, 192]],
  [30, [245, 217, 143]],
  [12, [239, 192, 115]],
  [6, [232, 166, 94]],
  [2, [217, 128, 63]],
  [0, [194, 96, 58]],
  [-3, [150, 69, 90]],
  [-6, [107, 58, 110]],
  [-12, [58, 46, 99]],
  [-18, [30, 36, 80]],
  [-90, [12, 20, 52]],
];

// Interpolating gold to indigo in sRGB passes through a dead grey. Oklab is
// perceptually uniform, so the same blend stays saturated the whole way.
function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

type Oklab = [number, number, number];

function toOklab([r, g, b]: [number, number, number]): Oklab {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, a, b]: Oklab): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const bl = linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Colour of the light when the sun sits `alt` degrees above the horizon. */
export function lightAt(alt: number): string {
  if (alt >= KEYFRAMES[0][0]) return fromOklab(toOklab(KEYFRAMES[0][1]));
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    const [a1, c1] = KEYFRAMES[i];
    const [a2, c2] = KEYFRAMES[i + 1];
    if (alt <= a1 && alt >= a2) {
      const t = (a1 - alt) / (a1 - a2);
      const A = toOklab(c1);
      const B = toOklab(c2);
      return fromOklab([
        A[0] + (B[0] - A[0]) * t,
        A[1] + (B[1] - A[1]) * t,
        A[2] + (B[2] - A[2]) * t,
      ]);
    }
  }
  return fromOklab(toOklab(KEYFRAMES[KEYFRAMES.length - 1][1]));
}

/**
 * Blend two colours in Oklab. Used to fade the ring toward the backdrop instead
 * of fading its opacity: translucent strokes that overlap double their alpha at
 * the joins, so anything that varies alpha along the ring bands visibly.
 */
export function mixColors(from: string, to: string, t: number): string {
  const A = toOklab(parseHex(from));
  const B = toOklab(parseHex(to));
  const k = Math.max(0, Math.min(1, t));
  return fromOklab([
    A[0] + (B[0] - A[0]) * k,
    A[1] + (B[1] - A[1]) * k,
    A[2] + (B[2] - A[2]) * k,
  ]);
}

function parseHex(c: string): [number, number, number] {
  const h = c.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((x) => x + x)
          .join("")
      : h.padEnd(6, "0");
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/**
 * How fast the sky darkens as you look away from the sun. The one number that
 * makes a low sun read as an ember horizon under a dark zenith, and a high sun
 * light the whole disc evenly.
 */
const FALLOFF = 0.45;

/**
 * Colour of the sky at `elevation` degrees above the horizon, given where the
 * sun currently is. Brightest at the sun's own elevation, falling away from it.
 */
export function skyAt(sunAlt: number, elevation: number): string {
  return lightAt(sunAlt - Math.abs(elevation - sunAlt) * FALLOFF);
}

/** 0 while the sun is up, ramping to 1 once it is well down. */
export function starLevel(sunAlt: number): number {
  return Math.max(0, Math.min(1, (-sunAlt - 4) / 14));
}

/**
 * Sun altitude in DEGREES.
 *
 * suncalc 2.x returns `getPosition().altitude` already in degrees, despite most
 * examples treating it as radians. Verified against an independent NOAA
 * implementation: both give 49.9 degrees at solar noon in Casablanca on
 * 2026-03-04. `__tests__/utils/sky.test.ts` pins this.
 */
export function sunAltitude(date: Date, latitude: number, longitude: number): number {
  return SunCalc.getPosition(date, latitude, longitude).altitude;
}

export type SunDay = {
  /** Minutes past local midnight, or null at latitudes with no sunrise/sunset. */
  sunrise: number | null;
  sunset: number | null;
};

function minutesPastMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

/**
 * Sunrise and sunset for a date. Returns nulls inside a polar day or night,
 * where suncalc yields Invalid Date and the dial falls back to its plain ring.
 */
export function sunDay(date: Date, latitude: number, longitude: number): SunDay {
  const t = SunCalc.getTimes(date, latitude, longitude);
  const ok = (d: Date | null): d is Date =>
    d instanceof Date && !Number.isNaN(d.getTime());
  return {
    sunrise: ok(t.sunrise) ? minutesPastMidnight(t.sunrise) : null,
    sunset: ok(t.sunset) ? minutesPastMidnight(t.sunset) : null,
  };
}
