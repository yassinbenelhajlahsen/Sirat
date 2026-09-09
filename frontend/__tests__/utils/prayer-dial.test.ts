import {
  DIAL,
  RING_SEGMENTS,
  angleForMinutes,
  buildRing,
  daylightLabel,
  dialMarkers,
  discStops,
  minutesOfDay,
  parsePrayerTime,
  pointOnRing,
  ringColor,
  ringPresence,
  STARS,
} from "@/utils/prayerDial";

const LAT = 33.5731;
const LNG = -7.5898;
const DAY = new Date(2026, 2, 4);

const FULL = [
  { label: "Fajr", time: "5:35 AM" },
  { label: "Sunrise", time: "6:57 AM" },
  { label: "Dhuhr", time: "1:00 PM" },
  { label: "Asr", time: "4:15 PM" },
  { label: "Maghrib", time: "6:33 PM" },
  { label: "Isha", time: "7:53 PM" },
];

describe("angleForMinutes", () => {
  it("puts noon at the top and midnight at the bottom", () => {
    expect(angleForMinutes(720)).toBe(0);
    expect(Math.abs(angleForMinutes(0))).toBe(180);
    expect(angleForMinutes(1440)).toBe(180);
  });

  it("runs clockwise, so the afternoon is on the right", () => {
    expect(angleForMinutes(1080)).toBeGreaterThan(0);
    expect(angleForMinutes(360)).toBeLessThan(0);
  });
});

describe("pointOnRing", () => {
  it("places 0 degrees at the top of the dial", () => {
    const p = pointOnRing(0);
    expect(p.x).toBeCloseTo(DIAL.cx, 5);
    expect(p.y).toBeCloseTo(DIAL.cy - DIAL.ringRadius, 5);
  });

  it("places 90 degrees at the right", () => {
    const p = pointOnRing(90);
    expect(p.x).toBeCloseTo(DIAL.cx + DIAL.ringRadius, 5);
    expect(p.y).toBeCloseTo(DIAL.cy, 5);
  });
});

describe("buildRing", () => {
  const ring = buildRing(DAY, LAT, LNG);

  it("covers the whole day at the configured resolution", () => {
    expect(ring).toHaveLength(RING_SEGMENTS);
    expect(ring[ring.length - 1].end).toBe(1440);
  });

  it("gives every segment a real colour and a drawable arc", () => {
    for (const s of ring) {
      expect(s.c).toMatch(/^#[0-9a-f]{6}$/);
      expect(s.d).toMatch(/^M [\d.-]+ [\d.-]+ A 110 110 0 [01] 1 [\d.-]+ [\d.-]+$/);
    }
  });

  it("is bright around noon and dark around midnight", () => {
    const lum = (i: number) => {
      const c = ring[i].c;
      return (
        0.2126 * parseInt(c.slice(1, 3), 16) +
        0.7152 * parseInt(c.slice(3, 5), 16) +
        0.0722 * parseInt(c.slice(5, 7), 16)
      );
    };
    const noon = Math.floor((720 / 1440) * RING_SEGMENTS);
    const midnight = 0;
    expect(lum(noon)).toBeGreaterThan(lum(midnight) + 100);
  });

  it("does not depend on the time of day, only the date", () => {
    const morning = new Date(2026, 2, 4, 7, 0, 0);
    const evening = new Date(2026, 2, 4, 21, 0, 0);
    expect(buildRing(morning, LAT, LNG).map((s) => s.c)).toEqual(
      buildRing(evening, LAT, LNG).map((s) => s.c),
    );
  });

  it("changes with the season, so a summer ring is not a winter ring", () => {
    const june = buildRing(new Date(2026, 5, 21), LAT, LNG).map((s) => s.c);
    const december = buildRing(new Date(2026, 11, 21), LAT, LNG).map((s) => s.c);
    expect(june).not.toEqual(december);
  });
});

describe("ringPresence", () => {
  it("is continuous across the midnight seam", () => {
    // The bug this pins: the elapsed span has two ends because the ring is a
    // loop and the day is a line. A hard step at midnight, with nothing there
    // to mark it, reads as a rendering fault rather than as information.
    const now = 1200;
    const justAfterMidnight = ringPresence(4, now);
    const justBeforeMidnight = ringPresence(1436, now);
    expect(Math.abs(justAfterMidnight - justBeforeMidnight)).toBeLessThan(0.02);
  });

  it("reaches full strength through the middle of the elapsed day", () => {
    expect(ringPresence(700, 1200)).toBeCloseTo(1, 5);
  });

  it("dims everything still to come", () => {
    const future = ringPresence(1300, 1200);
    expect(future).toBeGreaterThan(0);
    expect(future).toBeLessThan(0.3);
  });

  it("eases up from midnight rather than jumping", () => {
    const ramp = [0, 30, 60, 120, 180, 240].map((m) => ringPresence(m, 1200));
    for (let i = 1; i < ramp.length; i++) {
      expect(ramp[i]).toBeGreaterThanOrEqual(ramp[i - 1]);
    }
    expect(ramp[0]).toBeLessThan(ramp[ramp.length - 1]);
  });

  it("is a flat full ring when there is no now", () => {
    for (const m of [0, 400, 900, 1440]) expect(ringPresence(m, null)).toBe(1);
  });
});

describe("ringColor", () => {
  it("fades toward the backdrop instead of toward transparency", () => {
    const seg = { d: "", c: "#E8C77A", end: 1300 };
    const dim = ringColor(seg, 1200, "#0A150E");
    const lit = ringColor({ ...seg, end: 700 }, 1200, "#0A150E");
    expect(dim).toMatch(/^#[0-9a-f]{6}$/);
    expect(lit.toLowerCase()).toBe("#e8c77a");
    // The dimmed colour is closer to the backdrop than the lit one is.
    const dist = (c: string) =>
      Math.abs(parseInt(c.slice(1, 3), 16) - 0x0a) + Math.abs(parseInt(c.slice(3, 5), 16) - 0x15);
    expect(dist(dim)).toBeLessThan(dist(lit));
  });
});

describe("discStops", () => {
  it("runs horizon to zenith with usable offsets and opacities", () => {
    const stops = discStops(10);
    expect(stops[0].offset).toBe(0);
    expect(stops[stops.length - 1].offset).toBe(1);
    for (const s of stops) {
      expect(s.opacity).toBeGreaterThan(0);
      expect(s.opacity).toBeLessThanOrEqual(1);
      expect(s.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("thins out towards the top so the centre numerals stay legible", () => {
    const stops = discStops(10);
    expect(stops[stops.length - 1].opacity).toBeLessThan(stops[0].opacity);
  });
});

describe("STARS", () => {
  it("keeps clear of the centre type", () => {
    for (const s of STARS) {
      const inText = s.x > 90 && s.x < 210 && s.y > 102 && s.y < 202;
      expect(inText).toBe(false);
    }
  });

  it("stays inside the disc", () => {
    for (const s of STARS) {
      expect(Math.hypot(s.x - DIAL.cx, s.y - DIAL.cy)).toBeLessThanOrEqual(DIAL.discRadius);
    }
  });

  it("varies in size and brightness rather than reading as identical dots", () => {
    expect(new Set(STARS.map((s) => s.r)).size).toBeGreaterThan(5);
    expect(new Set(STARS.map((s) => s.o)).size).toBeGreaterThan(5);
  });
});

describe("dialMarkers", () => {
  const markers = dialMarkers(FULL, DAY);

  it("returns the six labels in dial order with Sunrise as a notch", () => {
    expect(markers.map((m) => m.label)).toEqual([
      "Fajr",
      "Sunrise",
      "Dhuhr",
      "Asr",
      "Maghrib",
      "Isha",
    ]);
    expect(markers.filter((m) => m.notch).map((m) => m.label)).toEqual(["Sunrise"]);
  });

  it("spaces markers by real time, not evenly", () => {
    // The whole point of the dial: Sunrise to Dhuhr is a much longer gap than
    // Maghrib to Isha, and the geometry has to show that.
    const by = Object.fromEntries(markers.map((m) => [m.label, m.angle]));
    const sunriseToDhuhr = by.Dhuhr - by.Sunrise;
    const maghribToIsha = by.Isha - by.Maghrib;
    expect(sunriseToDhuhr).toBeGreaterThan(maghribToIsha * 3);
  });

  it("survives a missing prayer without producing NaN geometry", () => {
    const partial = dialMarkers([{ label: "Fajr", time: "5:35 AM" }], DAY);
    for (const m of partial) {
      expect(Number.isFinite(m.point.x)).toBe(true);
      expect(Number.isFinite(m.point.y)).toBe(true);
    }
    expect(partial.find((m) => m.label === "Isha")?.time).toBeNull();
  });
});

describe("parsePrayerTime", () => {
  it("reads 12-hour times onto the given day", () => {
    const d = parsePrayerTime("1:05 PM", DAY)!;
    expect(d.getHours()).toBe(13);
    expect(d.getMinutes()).toBe(5);
  });

  it("handles both midnight and noon", () => {
    expect(parsePrayerTime("12:00 AM", DAY)!.getHours()).toBe(0);
    expect(parsePrayerTime("12:00 PM", DAY)!.getHours()).toBe(12);
  });

  it("returns null on junk", () => {
    expect(parsePrayerTime("", DAY)).toBeNull();
    expect(parsePrayerTime("not a time", DAY)).toBeNull();
  });
});

describe("minutesOfDay", () => {
  it("counts minutes past local midnight", () => {
    expect(minutesOfDay(new Date(2026, 2, 4, 0, 0, 0))).toBe(0);
    expect(minutesOfDay(new Date(2026, 2, 4, 12, 30, 0))).toBe(750);
  });
});

describe("daylightLabel", () => {
  it("formats hours and minutes", () => {
    expect(daylightLabel(417, 1110)).toBe("11 hr 33 min of daylight");
  });

  it("returns null when the day has no usable sunrise or sunset", () => {
    expect(daylightLabel(null, 1110)).toBeNull();
    expect(daylightLabel(417, null)).toBeNull();
    expect(daylightLabel(1110, 417)).toBeNull();
  });
});
