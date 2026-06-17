import {
  distanceKm,
  formatDistanceLabel,
  formatDistanceShort,
  bearingDeg,
  cardinal,
} from "@/utils/geo";

describe("geo", () => {
  const a = { lat: 41.881, lng: -87.623 };

  it("distanceKm is ~0 for the same point and positive otherwise", () => {
    expect(distanceKm(a.lat, a.lng, a.lat, a.lng)).toBeCloseTo(0, 5);
    expect(distanceKm(41.88, -87.62, 41.89, -87.63)).toBeGreaterThan(0);
  });

  it("formatDistanceLabel keeps imperial 'away' phrasing", () => {
    expect(formatDistanceLabel(0.05)).toMatch(/ft away$/);
    expect(formatDistanceLabel(1)).toMatch(/mi away$/);
    expect(formatDistanceLabel(NaN)).toBe("");
  });

  it("formatDistanceShort drops the 'away' suffix", () => {
    expect(formatDistanceShort(1)).toMatch(/mi$/);
    expect(formatDistanceShort(1)).not.toMatch(/away/);
    expect(formatDistanceShort(0.05)).toMatch(/ft$/);
  });

  it("bearingDeg returns 0..360 with cardinal directions correct", () => {
    expect(bearingDeg(0, 0, 1, 0)).toBeCloseTo(0, 0);
    expect(bearingDeg(0, 0, 0, 1)).toBeCloseTo(90, 0);
    expect(bearingDeg(1, 0, 0, 0)).toBeCloseTo(180, 0);
    expect(bearingDeg(0, 1, 0, 0)).toBeCloseTo(270, 0);
  });

  it("cardinal maps degrees to the 8-point compass", () => {
    expect(cardinal(0)).toBe("N");
    expect(cardinal(45)).toBe("NE");
    expect(cardinal(90)).toBe("E");
    expect(cardinal(135)).toBe("SE");
    expect(cardinal(180)).toBe("S");
    expect(cardinal(225)).toBe("SW");
    expect(cardinal(270)).toBe("W");
    expect(cardinal(315)).toBe("NW");
    expect(cardinal(359)).toBe("N");
  });
});
