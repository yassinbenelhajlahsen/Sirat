import { buildPrayerTimeline, type WidgetDay } from "@/services/widgets/timeline";

const day = (y: number, m: number, d: number, shift = 0): WidgetDay => ({
  date: new Date(y, m - 1, d),
  times: [
    { label: "Fajr", time: `${5 + shift}:48 AM` },
    { label: "Sunrise", time: `${7 + shift}:02 AM` },
    { label: "Dhuhr", time: "12:43 PM" },
    { label: "Asr", time: "3:52 PM" },
    { label: "Maghrib", time: "6:21 PM" },
    { label: "Isha", time: "7:36 PM" },
  ],
});

const oct9 = day(2026, 10, 9);
const oct10 = day(2026, 10, 10);

describe("buildPrayerTimeline", () => {
  it("starts with an entry for now that points at the next prayer", () => {
    const now = new Date(2026, 9, 9, 11, 45);
    const [first] = buildPrayerTimeline([oct9], now);

    expect(first.date).toEqual(now);
    expect(first.props).toMatchObject({
      stale: false,
      next: { name: "Dhuhr", time: "12:43 PM" },
      sunrise: "7:02 AM",
      gregorian: "Fri, Oct 9",
    });
    expect(first.props.hijri).toMatch(/1448/);
    expect(first.props.prayers.map((p) => p.name)).toEqual([
      "Fajr",
      "Dhuhr",
      "Asr",
      "Maghrib",
      "Isha",
    ]);
    expect(first.props.next.at).toBe(new Date(2026, 9, 9, 12, 43).getTime());
  });

  it("adds an entry at each prayer time that moves to the following prayer", () => {
    const now = new Date(2026, 9, 9, 11, 45);
    const entries = buildPrayerTimeline([oct9, oct10], now);

    const summary = entries.slice(0, 5).map((e) => [e.date.getTime(), e.props.next.name]);
    expect(summary).toEqual([
      [now.getTime(), "Dhuhr"],
      [new Date(2026, 9, 9, 12, 43).getTime(), "Asr"],
      [new Date(2026, 9, 9, 15, 52).getTime(), "Maghrib"],
      [new Date(2026, 9, 9, 18, 21).getTime(), "Isha"],
      [new Date(2026, 9, 9, 19, 36).getTime(), "Fajr"],
    ]);
  });

  it("shows tomorrow's list and date once Isha has passed", () => {
    const now = new Date(2026, 9, 9, 20, 0);
    const [first] = buildPrayerTimeline([oct9, day(2026, 10, 10, 1)], now);

    expect(first.props.gregorian).toBe("Sat, Oct 10");
    expect(first.props.next).toMatchObject({ name: "Fajr", time: "6:48 AM" });
    expect(first.props.prayers[0]).toMatchObject({ name: "Fajr", time: "6:48 AM" });
    expect(first.props.sunrise).toBe("8:02 AM");
  });

  it("keeps today's list between midnight and Fajr", () => {
    const now = new Date(2026, 9, 10, 1, 0);
    const [first] = buildPrayerTimeline([oct9, oct10], now);

    expect(first.props.gregorian).toBe("Sat, Oct 10");
    expect(first.props.next.name).toBe("Fajr");
  });

  it("marks the last entry stale when the stored days run out", () => {
    const now = new Date(2026, 9, 9, 11, 45);
    const entries = buildPrayerTimeline([oct9], now);
    const last = entries[entries.length - 1];

    expect(last.date).toEqual(new Date(2026, 9, 9, 19, 36));
    expect(last.props.stale).toBe(true);
  });

  it("returns a single stale entry when no day has a future prayer", () => {
    const now = new Date(2026, 9, 9, 22, 0);
    const entries = buildPrayerTimeline([oct9], now);

    expect(entries).toHaveLength(1);
    expect(entries[0].props.stale).toBe(true);
  });

  it("stops at the first day with missing times", () => {
    const now = new Date(2026, 9, 9, 11, 45);
    const empty: WidgetDay = { date: new Date(2026, 9, 10), times: [] };
    const entries = buildPrayerTimeline([oct9, empty, day(2026, 10, 11)], now);

    expect(entries[entries.length - 1].props.stale).toBe(true);
    expect(entries.every((e) => e.date.getTime() <= new Date(2026, 9, 9, 19, 36).getTime())).toBe(true);
  });

  it("returns a stale entry when there are no days at all", () => {
    const entries = buildPrayerTimeline([], new Date(2026, 9, 9, 11, 45));
    expect(entries).toHaveLength(1);
    expect(entries[0].props.stale).toBe(true);
  });
});
