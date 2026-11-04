import { buildPrayerDay, maghribOf } from "@/services/prayerDay";
import { formatHijriDate, isFastingDay, isMissedFastDay, ramadanDayAt, ramadanPeriod, setPretendRamadan, isPretendingRamadan } from "@/utils/hijriDate";

// Nov 3 2026 is 23 Jumada I 1448 in Umm al-Qura, the calendar the holiday feed uses.
const nov3 = (h: number, m = 0) => new Date(2026, 10, 3, h, m);
const times = [
  { label: "Fajr", time: "5:25 AM" },
  { label: "Maghrib", time: "4:55 PM" },
  { label: "Isha", time: "6:15 PM" },
];

describe("formatHijriDate", () => {
  it("uses Umm al-Qura so it agrees with the holiday feed", () => {
    expect(formatHijriDate(nov3(12))).toBe("Jumada I 23, 1448 AH");
    // Aladhan (HJCoSA) puts 1 Ramadan 1448 on Feb 8 2027.
    expect(formatHijriDate(new Date(2027, 1, 8, 12))).toBe("Ramadan 1, 1448 AH");
  });

  it("keeps the day's date before Maghrib", () => {
    expect(formatHijriDate(nov3(16, 54), maghribOf(buildPrayerDay(nov3(0), times)))).toBe("Jumada I 23, 1448 AH");
  });

  it("rolls to the next date at Maghrib", () => {
    expect(formatHijriDate(nov3(16, 55), maghribOf(buildPrayerDay(nov3(0), times)))).toBe("Jumada I 24, 1448 AH");
    expect(formatHijriDate(nov3(19, 16), maghribOf(buildPrayerDay(nov3(0), times)))).toBe("Jumada I 24, 1448 AH");
  });

  it("follows the Gregorian day when Maghrib is unknown", () => {
    expect(maghribOf(buildPrayerDay(nov3(0), []))).toBeNull();
    expect(formatHijriDate(nov3(19, 16), null)).toBe("Jumada I 23, 1448 AH");
  });
});

describe("isFastingDay (Ramadan 1448)", () => {
  it("is false on Sha'ban 30, true on Ramadan 1 and 29, false on Shawwal 1", () => {
    expect(isFastingDay(new Date(2027, 1, 7))).toBe(false);
    expect(isFastingDay(new Date(2027, 1, 8))).toBe(true);
    expect(isFastingDay(new Date(2027, 2, 8))).toBe(true);
    expect(isFastingDay(new Date(2027, 2, 9))).toBe(false);
  });

  it("is false for an ordinary day", () => {
    expect(isFastingDay(nov3(12))).toBe(false);
  });
});

describe("ramadanDayAt", () => {
  const feb = (d: number, h: number, m = 0) => new Date(2027, 1, d, h, m);
  const mar = (d: number, h: number, m = 0) => new Date(2027, 2, d, h, m);
  const maghribAt = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 17, 30);

  it("starts the evening before the first fast", () => {
    expect(ramadanDayAt(feb(7, 12), maghribAt(feb(7, 0)))).toBeNull();
    expect(ramadanDayAt(feb(7, 17, 30), maghribAt(feb(7, 0)))).toBe(1);
    expect(ramadanDayAt(feb(8, 9), maghribAt(feb(8, 0)))).toBe(1);
  });

  it("ends at Maghrib on the last day", () => {
    expect(ramadanDayAt(mar(8, 12), maghribAt(mar(8, 0)))).toBe(29);
    expect(ramadanDayAt(mar(8, 17, 29), maghribAt(mar(8, 0)))).toBe(29);
    expect(ramadanDayAt(mar(8, 17, 30), maghribAt(mar(8, 0)))).toBeNull();
  });

  it("follows the Gregorian day when Maghrib is unknown", () => {
    expect(ramadanDayAt(feb(7, 20))).toBeNull();
    expect(ramadanDayAt(feb(8, 3))).toBe(1);
  });
});

describe("dev pretend-Ramadan switch", () => {
  afterEach(() => setPretendRamadan(false));

  it("treats every day as a fasting day and keeps the Hijri day number", () => {
    const shawwal = new Date(2027, 2, 9, 10);
    expect(isFastingDay(shawwal)).toBe(false);
    expect(ramadanDayAt(shawwal)).toBeNull();

    setPretendRamadan(true);
    expect(isPretendingRamadan()).toBe(true);
    expect(isFastingDay(shawwal)).toBe(true);
    expect(ramadanDayAt(shawwal)).toBe(1);
  });
});

describe("ramadanPeriod", () => {
  it("finds the first and last fasting day from Umm al-Qura", () => {
    expect(ramadanPeriod(2027)).toEqual({ start: new Date(2027, 1, 8), end: new Date(2027, 2, 8) });
    expect(ramadanPeriod(2026)).toEqual({ start: new Date(2026, 1, 18), end: new Date(2026, 2, 19) });
  });

  it("runs on past a year end when Ramadan does", () => {
    expect(ramadanPeriod(2028)).toEqual({ start: new Date(2028, 0, 28), end: new Date(2028, 1, 25) });
  });
});

describe("isMissedFastDay", () => {
  it("allows Ramadan days and 3 days either side, since moon sighting varies", () => {
    expect(isMissedFastDay(new Date(2027, 1, 3))).toBe(false);
    expect(isMissedFastDay(new Date(2027, 1, 4))).toBe(false);
    expect(isMissedFastDay(new Date(2027, 1, 5))).toBe(true);
    expect(isMissedFastDay(new Date(2027, 1, 20))).toBe(true);
    expect(isMissedFastDay(new Date(2027, 2, 11))).toBe(true);
    expect(isMissedFastDay(new Date(2027, 2, 12))).toBe(false);
  });
});
