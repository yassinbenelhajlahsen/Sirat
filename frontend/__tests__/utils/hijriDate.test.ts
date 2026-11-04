import { formatHijriDate, maghribOn } from "@/utils/hijriDate";

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
    expect(formatHijriDate(nov3(16, 54), maghribOn(nov3(0), times))).toBe("Jumada I 23, 1448 AH");
  });

  it("rolls to the next date at Maghrib", () => {
    expect(formatHijriDate(nov3(16, 55), maghribOn(nov3(0), times))).toBe("Jumada I 24, 1448 AH");
    expect(formatHijriDate(nov3(19, 16), maghribOn(nov3(0), times))).toBe("Jumada I 24, 1448 AH");
  });

  it("follows the Gregorian day when Maghrib is unknown", () => {
    expect(maghribOn(nov3(0), [])).toBeNull();
    expect(formatHijriDate(nov3(19, 16), null)).toBe("Jumada I 23, 1448 AH");
  });
});
