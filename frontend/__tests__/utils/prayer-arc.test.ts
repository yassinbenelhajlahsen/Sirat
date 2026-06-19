import {
  ARC_PRAYER_ORDER,
  arcLength,
  arcPoint,
  parsePrayerTime,
  prayerSlotT,
  prayerStates,
  sunMarker,
} from "@/utils/prayerArc";

const FULL = [
  { label: "Fajr", time: "5:00 AM" },
  { label: "Sunrise", time: "6:30 AM" },
  { label: "Dhuhr", time: "12:30 PM" },
  { label: "Asr", time: "3:30 PM" },
  { label: "Maghrib", time: "6:00 PM" },
  { label: "Isha", time: "8:00 PM" },
];

describe("arcPoint", () => {
  it("places endpoints on the horizon and the apex centred", () => {
    expect(arcPoint(0)).toEqual({ x: 25, y: 92 });
    expect(arcPoint(1)).toEqual({ x: 275, y: 92 });
    const mid = arcPoint(0.5);
    expect(mid.x).toBe(150);
    expect(mid.y).toBeCloseTo(47, 5);
  });

  it("keeps x evenly spaced (centred control point → x linear in t)", () => {
    expect(arcPoint(0.2).x).toBeCloseTo(75, 5);
    expect(arcPoint(0.4).x).toBeCloseTo(125, 5);
    expect(arcPoint(0.8).x).toBeCloseTo(225, 5);
  });

  it("clamps t outside [0,1]", () => {
    expect(arcPoint(-1)).toEqual(arcPoint(0));
    expect(arcPoint(2)).toEqual(arcPoint(1));
  });
});

describe("prayerSlotT", () => {
  it("spreads the six prayers evenly across the arc", () => {
    expect(ARC_PRAYER_ORDER.map((_, i) => prayerSlotT(i))).toEqual([
      0, 0.2, 0.4, 0.6, 0.8, 1,
    ]);
  });
});

describe("arcLength", () => {
  it("is zero at the start and grows past the chord", () => {
    expect(arcLength(0)).toBe(0);
    expect(arcLength(0.5)).toBeLessThan(arcLength(1));
    expect(arcLength(1)).toBeGreaterThan(250);
    expect(arcLength(1)).toBeLessThan(360);
  });
});

describe("prayerStates", () => {
  it("marks passed / next / upcoming relative to the next prayer", () => {
    const states = prayerStates(FULL, "Maghrib");
    expect(states.map((s) => s.state)).toEqual([
      "passed",
      "passed",
      "passed",
      "passed",
      "next",
      "upcoming",
    ]);
    expect(states[4].label).toBe("Maghrib");
    expect(states[4].time).toBe("6:00 PM");
  });

  it("treats everything as passed when there is no next prayer", () => {
    expect(prayerStates(FULL, null).every((s) => s.state === "passed")).toBe(true);
  });

  it("returns null time for a missing prayer", () => {
    const states = prayerStates([{ label: "Fajr", time: "5:00 AM" }], "Fajr");
    expect(states.find((s) => s.label === "Isha")?.time).toBeNull();
  });
});

describe("parsePrayerTime", () => {
  const base = new Date(2026, 5, 17);

  it("parses 12h times into 24h", () => {
    expect(parsePrayerTime("12:30 PM", base)?.getHours()).toBe(12);
    expect(parsePrayerTime("12:00 AM", base)?.getHours()).toBe(0);
    expect(parsePrayerTime("5:00 AM", base)?.getHours()).toBe(5);
    expect(parsePrayerTime("8:00 PM", base)?.getHours()).toBe(20);
  });

  it("returns null for junk", () => {
    expect(parsePrayerTime("", base)).toBeNull();
    expect(parsePrayerTime("nope", base)).toBeNull();
  });
});

describe("sunMarker", () => {
  const day = new Date(2026, 5, 17);
  const at = (h: number, m: number) => {
    const d = new Date(day);
    d.setHours(h, m, 0, 0);
    return d;
  };

  it("interpolates between bounding prayers during the day", () => {
    const marker = sunMarker(FULL, at(16, 30)); // between Asr (15:30) and Maghrib (18:00)
    expect(marker).not.toBeNull();
    expect(marker!.isNight).toBe(false);
    expect(marker!.t).toBeGreaterThan(0.6);
    expect(marker!.t).toBeLessThan(0.8);
  });

  it("is night after Maghrib", () => {
    expect(sunMarker(FULL, at(19, 0))!.isNight).toBe(true);
  });

  it("clamps to the start (night) before Fajr", () => {
    expect(sunMarker(FULL, at(4, 0))).toEqual({ t: 0, isNight: true });
  });

  it("clamps to the end (night) after Isha", () => {
    expect(sunMarker(FULL, at(21, 0))).toEqual({ t: 1, isNight: true });
  });

  it("returns null on an incomplete timeline", () => {
    expect(sunMarker([{ label: "Fajr", time: "5:00 AM" }], at(16, 30))).toBeNull();
  });
});
