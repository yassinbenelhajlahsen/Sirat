import { lightAt, skyAt, starLevel, sunAltitude, sunDay } from "@/utils/sky";

// Casablanca. Chosen because the whole design was calibrated against this day,
// and its numbers were checked against an independent NOAA implementation.
const LAT = 33.5731;
const LNG = -7.5898;

describe("sunAltitude", () => {
  it("returns DEGREES, not radians", () => {
    // suncalc's own docs and most examples imply radians. It does not. If this
    // ever flips, every colour on the dial silently goes wrong rather than
    // throwing, so the units are pinned here on purpose.
    const noon = new Date("2026-03-04T13:00:00Z");
    const alt = sunAltitude(noon, LAT, LNG);
    expect(alt).toBeGreaterThan(45);
    expect(alt).toBeLessThan(55);
  });

  it("agrees with an independent solar calculation at noon", () => {
    const noon = new Date("2026-03-04T13:00:00Z");
    expect(sunAltitude(noon, LAT, LNG)).toBeCloseTo(49.9, 0);
  });

  it("is negative in the middle of the night and positive in the day", () => {
    expect(sunAltitude(new Date("2026-03-04T02:00:00Z"), LAT, LNG)).toBeLessThan(0);
    expect(sunAltitude(new Date("2026-03-04T11:00:00Z"), LAT, LNG)).toBeGreaterThan(0);
  });
});

describe("sunDay", () => {
  it("gives sunrise before sunset, both within the day", () => {
    const { sunrise, sunset } = sunDay(new Date("2026-03-04T12:00:00Z"), LAT, LNG);
    expect(sunrise).not.toBeNull();
    expect(sunset).not.toBeNull();
    expect(sunrise!).toBeLessThan(sunset!);
    expect(sunrise!).toBeGreaterThan(0);
    expect(sunset!).toBeLessThan(1440);
  });

  it("returns nulls inside a polar night so the dial can fall back", () => {
    // Longyearbyen in December: the sun never rises.
    const { sunrise, sunset } = sunDay(new Date("2026-12-21T12:00:00Z"), 78.22, 15.65);
    expect(sunrise).toBeNull();
    expect(sunset).toBeNull();
  });
});

describe("lightAt", () => {
  it("is gold high up and indigo underground", () => {
    expect(lightAt(60)).toMatch(/^#[0-9a-f]{6}$/);
    // A high sun is warm and bright: red channel well above blue.
    const noon = hex(lightAt(50));
    expect(noon.r).toBeGreaterThan(noon.b);
    // Deep night inverts that: blue above red.
    const night = hex(lightAt(-40));
    expect(night.b).toBeGreaterThan(night.r);
  });

  it("moves monotonically darker as the sun drops", () => {
    const lum = (a: number) => {
      const { r, g, b } = hex(lightAt(a));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const samples = [50, 20, 6, 0, -6, -12, -18, -40].map(lum);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeLessThan(samples[i - 1]);
    }
  });

  it("clamps outside the keyframe range instead of returning NaN", () => {
    expect(lightAt(120)).toMatch(/^#[0-9a-f]{6}$/);
    expect(lightAt(-200)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("skyAt", () => {
  it("puts the ember at the horizon and darkness overhead when the sun is setting", () => {
    const horizon = hex(skyAt(0, 0));
    const zenith = hex(skyAt(0, 90));
    expect(horizon.r).toBeGreaterThan(zenith.r);
    expect(zenith.b).toBeGreaterThan(zenith.r);
  });

  it("lights the whole disc when the sun is high, with no dark end", () => {
    // The bug this pins: an earlier model drew the disc as a cross-section, so
    // midday came out gold in the middle and black top and bottom.
    const lum = (e: number) => {
      const { r, g, b } = hex(skyAt(50, e));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    for (const e of [0, 30, 60, 90]) expect(lum(e)).toBeGreaterThan(150);
  });

  it("leaves the whole disc dark at night, top and bottom alike", () => {
    const lum = (e: number) => {
      const { r, g, b } = hex(skyAt(-35, e));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    for (const e of [0, 30, 60, 90]) expect(lum(e)).toBeLessThan(45);
  });
});

describe("starLevel", () => {
  it("shows no stars while the sun is up and full stars deep in the night", () => {
    expect(starLevel(20)).toBe(0);
    expect(starLevel(0)).toBe(0);
    expect(starLevel(-4)).toBe(0);
    expect(starLevel(-18)).toBe(1);
    expect(starLevel(-40)).toBe(1);
  });

  it("ramps in between rather than snapping", () => {
    const mid = starLevel(-11);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });
});

function hex(c: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(c.slice(1, 3), 16),
    g: parseInt(c.slice(3, 5), 16),
    b: parseInt(c.slice(5, 7), 16),
  };
}
