import { prayerNameForArcLabel } from "@/utils/prayerLabel";

describe("prayerNameForArcLabel", () => {
  it("maps the five canonical labels", () => {
    expect(prayerNameForArcLabel("Fajr")).toBe("fajr");
    expect(prayerNameForArcLabel("Dhuhr")).toBe("dhuhr");
    expect(prayerNameForArcLabel("Asr")).toBe("asr");
    expect(prayerNameForArcLabel("Maghrib")).toBe("maghrib");
    expect(prayerNameForArcLabel("Isha")).toBe("isha");
  });
  it("returns null for Sunrise and unknown labels", () => {
    expect(prayerNameForArcLabel("Sunrise")).toBeNull();
    expect(prayerNameForArcLabel("Whatever")).toBeNull();
  });
});
