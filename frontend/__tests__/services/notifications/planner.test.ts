import {
  planFingerprint,
  planNotifications,
  yyyymmdd,
  type PlanDay,
  type PlanInput,
} from "@/services/notifications/planner";
import { FRIDAY_MESSAGES } from "@/utils/notifications/fridayReminder";

const allPrefs = (on: boolean) => ({
  Fajr: on, Sunrise: on, Dhuhr: on, Asr: on, Maghrib: on, Isha: on,
});
const NO_WINDOW = { Fajr: false, Dhuhr: false, Asr: false, Maghrib: false };
const FULL_DAY = [
  { label: "Fajr", time: "05:00 AM" },
  { label: "Sunrise", time: "06:30 AM" },
  { label: "Dhuhr", time: "01:00 PM" },
  { label: "Asr", time: "05:30 PM" },
  { label: "Maghrib", time: "08:30 PM" },
  { label: "Isha", time: "10:00 PM" },
];

function days(start: Date, count: number, over: Partial<PlanDay> = {}): PlanDay[] {
  return Array.from({ length: count }, (_, i) => ({
    date: new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
    times: FULL_DAY,
    statuses: {},
    fasting: false,
    ...over,
  }));
}

function input(start: Date, count: number, over: Partial<PlanInput> = {}, dayOver: Partial<PlanDay> = {}): PlanInput {
  return {
    days: days(start, count, dayOver),
    cityDisplay: "Chicago",
    prefs: allPrefs(false),
    windowPrefs: NO_WINDOW,
    windowOffset: 15,
    fridayEnabled: false,
    prayerSound: "default",
    now: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 4, 0, 0).getTime(),
    ...over,
  };
}

const JAN1 = new Date(2026, 0, 1); // a Thursday

describe("planNotifications", () => {
  it("formats yyyymmdd deterministically", () => {
    expect(yyyymmdd(new Date(2026, 1, 3, 10, 11, 12))).toBe("2026-02-03");
  });

  it("plans a prayer alert with the city and day in its data", () => {
    const [n] = planNotifications(input(JAN1, 1, { prefs: { ...allPrefs(false), Fajr: true } }));
    expect(n.title).toBe("🌅 Fajr time");
    expect(n.body).toBe("05:00 AM in Chicago");
    expect(n.data).toEqual({ type: "prayer", label: "Fajr", timeLocal: "05:00 AM", city: "Chicago", dayKey: "2026-01-01" });
  });

  it("leaves out times at or before now", () => {
    const late = new Date(2026, 0, 1, 6, 0, 0).getTime();
    expect(planNotifications(input(JAN1, 1, { prefs: { ...allPrefs(false), Fajr: true }, now: late }))).toEqual([]);
  });

  it("plays the adhan only for prayer alerts; Sunrise and window reminders use the system sound", () => {
    const plan = planNotifications(
      input(JAN1, 1, {
        prefs: { ...allPrefs(false), Sunrise: true, Dhuhr: true },
        prayerSound: "adhan.caf",
        windowPrefs: { ...NO_WINDOW, Dhuhr: true },
      }),
    );
    expect(Object.fromEntries(plan.map((n) => [n.title, n.sound]))).toEqual({
      "🌞 Sunrise time": "default",
      "☀️ Dhuhr time": "adhan.caf",
      "Dhuhr ending soon": "default",
    });
  });

  describe("window reminders", () => {
    it("fire the offset before the next prayer for an unlogged prayer", () => {
      const [n] = planNotifications(input(JAN1, 1, { windowPrefs: { ...NO_WINDOW, Dhuhr: true } }));
      expect(n.title).toBe("Dhuhr ending soon");
      expect(n.body).toBe("Asr begins at 05:30 PM, in 15 min.");
      expect(n.data.type).toBe("window_reminder");
      expect([n.fireDate.getHours(), n.fireDate.getMinutes()]).toEqual([17, 15]);
    });

    it("are skipped when the prayer is logged, but not when its mark was cleared", () => {
      const withWindow = { windowPrefs: { ...NO_WINDOW, Dhuhr: true } };
      expect(planNotifications(input(JAN1, 1, withWindow, { statuses: { dhuhr: "missed" } }))).toEqual([]);
      expect(planNotifications(input(JAN1, 1, withWindow, { statuses: {} }))).toHaveLength(1);
    });

    it("use Sunrise as Fajr's boundary with 'is at' phrasing", () => {
      const [n] = planNotifications(input(JAN1, 1, { windowPrefs: { ...NO_WINDOW, Fajr: true } }));
      expect(n.title).toBe("Fajr ending soon");
      expect(n.body).toBe("Sunrise is at 06:30 AM, in 15 min.");
    });

    it("never exist for Isha", () => {
      const titles = planNotifications(input(JAN1, 1, { windowPrefs: { ...NO_WINDOW, Maghrib: true } })).map((n) => n.title);
      expect(titles).toEqual(["Maghrib ending soon"]);
    });
  });

  describe("friday reminder", () => {
    // Jan 2, 9 and 16 are Fridays.
    const friday = (over: Partial<PlanInput> = {}, count = 16, start = JAN1) =>
      planNotifications(input(start, count, { fridayEnabled: true, now: new Date(2026, 0, 1).getTime(), ...over }, { times: [] }));

    it("plans one per Friday between 9:00 and 11:00 local, none on other days", () => {
      const plan = friday();
      expect(plan.map((n) => n.fireDate.getDate())).toEqual([2, 9, 16]);
      plan.forEach((n) => {
        expect(n.fireDate.getDay()).toBe(5);
        expect([9, 10]).toContain(n.fireDate.getHours());
      });
      expect(plan[0]).toEqual(
        expect.objectContaining({ title: "Jumu'ah Mubarak", sound: "default", data: { type: "friday", url: "/Quran?surah=18&ayah=1" } }),
      );
      expect(FRIDAY_MESSAGES).toContain(plan[0].body);
    });

    it("uses the same time and text for a given Friday on every pass", () => {
      const a = friday({}, 3)[0];
      const b = friday({}, 3)[0];
      expect([b.fireDate, b.body]).toEqual([a.fireDate, a.body]);
    });

    it("skips a Friday whose time has passed and keeps one still ahead", () => {
      const jan2 = new Date(2026, 0, 2);
      expect(friday({ now: new Date(2026, 0, 2, 11, 30).getTime() }, 1, jan2)).toHaveLength(0);
      expect(friday({ now: new Date(2026, 0, 2, 8, 0).getTime() }, 1, jan2)).toHaveLength(1);
    });

    it("plans nothing when the toggle is off", () => {
      expect(friday({ fridayEnabled: false })).toHaveLength(0);
    });
  });

  describe("Ramadan wording", () => {
    it("retitles Maghrib to Maghrib/Iftar on fasting days only, keeping body, sound and data", () => {
      const start = new Date(2027, 1, 7);
      const plan = planNotifications({
        ...input(start, 2, { prefs: allPrefs(true), prayerSound: "adhan.caf" }),
        days: [
          ...days(start, 1, { fasting: false }),
          ...days(new Date(2027, 1, 8), 1, { fasting: true }),
        ],
      });
      const maghrib = plan.filter((n) => /Maghrib/.test(n.title));
      expect(maghrib.map((n) => [n.fireDate.getDate(), n.title])).toEqual([
        [7, "🌇 Maghrib time"],
        [8, "🌇 Maghrib/Iftar time"],
      ]);
      expect(maghrib[1].body).toBe("08:30 PM in Chicago");
      expect(maghrib[1].sound).toBe("adhan.caf");
      expect(maghrib[1].data).toEqual(expect.objectContaining({ type: "prayer", label: "Maghrib" }));
    });
  });

  describe("budget and seen keys", () => {
    it("sorts by fire time and keeps only the soonest within the budget", () => {
      const start = new Date(2026, 0, 1);
      const plan = planNotifications(input(start, 15, { prefs: allPrefs(true), now: start.getTime(), budget: 60 }));
      expect(plan).toHaveLength(60);
      const times = plan.map((n) => n.fireDate.getTime());
      expect(times).toEqual([...times].sort((a, b) => a - b));
      expect(plan[0].fireDate.getHours()).toBe(5);
    });

    it("shares one budget across every kind, keeping the soonest during Ramadan", () => {
      const start = new Date(2027, 1, 8);
      const plan = planNotifications({
        ...input(start, 14, {
          prefs: allPrefs(true),
          windowPrefs: { Fajr: true, Dhuhr: true, Asr: true, Maghrib: true },
          fridayEnabled: true,
          now: start.getTime(),
          budget: 60,
        }, { fasting: true }),
      });
      expect(plan).toHaveLength(60);
      expect(plan[59].fireDate.getDate()).toBeLessThan(8 + 7);
    });

    it("leaves out keys already scheduled, and the budget applies to what is left", () => {
      const base = input(JAN1, 1, { prefs: allPrefs(true) });
      const all = planNotifications(base);
      const seen = new Set([all[0].seenKey, all[1].seenKey]);
      const rest = planNotifications({ ...base, seen, budget: 2 });
      expect(rest.map((n) => n.seenKey)).toEqual([all[2].seenKey, all[3].seenKey]);
    });
  });
});

describe("planFingerprint", () => {
  const base = () => input(JAN1, 3, { prefs: allPrefs(true), windowPrefs: { ...NO_WINDOW, Dhuhr: true }, fridayEnabled: true });

  it("is the same for the same inputs, however late in the day it is asked", () => {
    expect(planFingerprint({ ...base(), now: new Date(2026, 0, 1, 23, 0).getTime() })).toBe(planFingerprint(base()));
  });

  it.each([
    ["a prayer pref", (i: PlanInput) => ({ ...i, prefs: { ...i.prefs, Asr: false } })],
    ["the sound", (i: PlanInput) => ({ ...i, prayerSound: "adhan.caf" })],
    ["the window offset", (i: PlanInput) => ({ ...i, windowOffset: 30 })],
    ["the city shown", (i: PlanInput) => ({ ...i, cityDisplay: "Cairo" })],
    ["a prayer time", (i: PlanInput) => ({ ...i, days: i.days.map((d) => ({ ...d, times: d.times.map((t) => (t.label === "Fajr" ? { ...t, time: "05:05 AM" } : t)) })) })],
    ["Ramadan wording", (i: PlanInput) => ({ ...i, days: i.days.map((d) => ({ ...d, fasting: true })) })],
    ["the Friday toggle", (i: PlanInput) => ({ ...i, fridayEnabled: false })],
    ["logging a prayer that has a window reminder", (i: PlanInput) => ({ ...i, days: i.days.map((d, k) => (k === 0 ? { ...d, statuses: { dhuhr: "prayed" as const } } : d)) })],
    ["the day", (i: PlanInput) => ({ ...i, days: i.days.map((d) => ({ ...d, date: new Date(d.date.getFullYear(), d.date.getMonth(), d.date.getDate() + 1) })) })],
  ])("changes when %s changes", (_name, change) => {
    expect(planFingerprint(change(base()))).not.toBe(planFingerprint(base()));
  });

  it("does not change when a mark that has no reminder is logged", () => {
    const logged = { ...base(), days: base().days.map((d) => ({ ...d, statuses: { isha: "prayed" as const } })) };
    expect(planFingerprint(logged)).toBe(planFingerprint(base()));
  });
});
