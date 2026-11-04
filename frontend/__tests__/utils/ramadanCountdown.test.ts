import { buildPrayerDay } from "@/services/prayerDay";
import { getRamadanCardState } from "@/utils/ramadanCountdown";

const times = [
  { label: "Fajr", time: "5:30 AM" },
  { label: "Maghrib", time: "5:30 PM" },
  { label: "Isha", time: "6:50 PM" },
];
const at = (month: number, day: number, h: number, m = 0) => new Date(2027, month, day, h, m);
const state = (now: Date, extra: object = {}) =>
  getRamadanCardState({
    now,
    enabled: true,
    prayerDay: buildPrayerDay(now, times),
    tomorrowFajr: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 5, 29),
    ...extra,
  });

describe("getRamadanCardState", () => {
  it("is hidden when Ramadan mode is off or outside Ramadan", () => {
    expect(state(at(1, 10, 9), { enabled: false })).toBeNull();
    expect(state(at(1, 7, 12))).toBeNull(); // Sha'ban 30 daytime
    expect(state(at(2, 9, 9))).toBeNull(); // Shawwal 1
  });

  it("shows suhoor before Fajr, with the Ramadan day", () => {
    const s = state(at(1, 8, 4))!;
    expect(s.day).toBe(1);
    expect(s.target?.kind).toBe("suhoor");
    expect(s.target?.at).toEqual(at(1, 8, 5, 30));
  });

  it("shows iftar between Fajr and Maghrib", () => {
    const s = state(at(1, 10, 12))!;
    expect(s.day).toBe(3);
    expect(s.target?.kind).toBe("iftar");
    expect(s.target?.at).toEqual(at(1, 10, 17, 30));
  });

  it("switches to next day's suhoor after Maghrib, and rolls the day number", () => {
    const s = state(at(1, 10, 19))!;
    expect(s.day).toBe(4);
    expect(s.target?.kind).toBe("suhoor");
    expect(s.target?.at).toEqual(at(1, 11, 5, 29));
  });

  it("appears the evening before the first fast, targeting its suhoor", () => {
    const s = state(at(1, 7, 18))!;
    expect(s.day).toBe(1);
    expect(s.target?.kind).toBe("suhoor");
    expect(s.target?.at).toEqual(at(1, 8, 5, 29));
  });

  it("hides at Maghrib on the last day, but shows iftar just before", () => {
    expect(state(at(2, 8, 17, 29))?.target?.kind).toBe("iftar");
    expect(state(at(2, 8, 17, 30))).toBeNull();
  });

  it("has no target after Maghrib when tomorrow's Fajr is unknown", () => {
    expect(state(at(1, 10, 19), { tomorrowFajr: null })).toEqual({ day: 4, target: null });
  });
});
