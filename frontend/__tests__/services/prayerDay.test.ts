import {
  buildPrayerDay,
  emptyPrayerDay,
  formatClock,
  maghribOf,
  nextSlot,
  slotAt,
  windowEnd,
} from "@/services/prayerDay";

const DAY = new Date(2026, 2, 4);
const ROWS = [
  { label: "Fajr", time: "5:35 AM" },
  { label: "Sunrise", time: "6:57 AM" },
  { label: "Dhuhr", time: "1:00 PM" },
  { label: "Asr", time: "4:15 PM" },
  { label: "Maghrib", time: "6:33 PM" },
  { label: "Isha", time: "7:53 PM" },
];
const at = (h: number, m = 0) => new Date(2026, 2, 4, h, m);

describe("buildPrayerDay", () => {
  it("turns stored rows into ordered slots on that day", () => {
    const day = buildPrayerDay(DAY, [...ROWS].reverse());
    expect(day.dateKey).toBe("2026-03-04");
    expect(day.slots.map((s) => s.name)).toEqual(["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"]);
    expect(day.slots[2].at).toEqual(at(13));
  });

  it("reads midnight and noon", () => {
    const day = buildPrayerDay(DAY, [
      { label: "Fajr", time: "12:05 AM" },
      { label: "Dhuhr", time: "12:00 PM" },
    ]);
    expect(slotAt(day, "Fajr")).toEqual(at(0, 5));
    expect(slotAt(day, "Dhuhr")).toEqual(at(12));
  });

  it("drops unreadable and unknown rows instead of producing bad dates", () => {
    const day = buildPrayerDay(DAY, [
      { label: "Fajr", time: "not a time" },
      { label: "Dhuhr", time: "" },
      { label: "Midnight", time: "12:00 AM" },
      { label: "Asr", time: "4:15 PM" },
    ]);
    expect(day.slots.map((s) => s.name)).toEqual(["Asr"]);
  });
});

describe("lookups", () => {
  const day = buildPrayerDay(DAY, ROWS);

  it("finds the next slot after now, Sunrise included, and null once the day is over", () => {
    expect(nextSlot(day, at(5, 0))?.name).toBe("Fajr");
    expect(nextSlot(day, at(6, 0))?.name).toBe("Sunrise");
    expect(nextSlot(day, at(18, 33))?.name).toBe("Isha");
    expect(nextSlot(day, at(20, 0))).toBeNull();
    expect(nextSlot(null, at(5, 0))).toBeNull();
    expect(nextSlot(emptyPrayerDay(DAY), at(5, 0))).toBeNull();
  });

  it("ends Fajr's window at Sunrise and gives Isha none", () => {
    expect(windowEnd(day, "Fajr")?.name).toBe("Sunrise");
    expect(windowEnd(day, "Dhuhr")?.name).toBe("Asr");
    expect(windowEnd(day, "Isha")).toBeNull();
  });

  it("gives Maghrib, or null when the day has none", () => {
    expect(maghribOf(day)).toEqual(at(18, 33));
    expect(maghribOf(emptyPrayerDay(DAY))).toBeNull();
    expect(maghribOf(null)).toBeNull();
  });
});

describe("formatClock", () => {
  it("formats 12-hour time without a leading zero", () => {
    expect(formatClock(at(0, 5))).toBe("12:05 AM");
    expect(formatClock(at(12, 0))).toBe("12:00 PM");
    expect(formatClock(at(13, 45))).toBe("1:45 PM");
    expect(formatClock(at(5, 30))).toBe("5:30 AM");
  });
});
