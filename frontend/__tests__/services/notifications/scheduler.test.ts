import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import {
  cancelPreviouslyScheduled,
  msUntilNextLocalMidnightPlus,
  scheduleForHorizon,
  yyyymmdd,
} from "@/services/notifications/scheduler";
import { FRIDAY_MESSAGES } from "@/utils/notifications/fridayReminder";
import {
  STORAGE_SCHEDULE_IDS,
  STORAGE_SEEN_KEYS,
} from "@/services/notifications/constants";

jest.mock("@/services/prayerTimes", () => ({
  getPrayerTimesForDate: jest.fn(),
}));

jest.mock("@/services/tracking/prayerLog", () => ({
  getDayStatuses: jest.fn(async () => ({})),
}));

import { getPrayerTimesForDate } from "@/services/prayerTimes";
import { getDayStatuses } from "@/services/tracking/prayerLog";

const mockGetPrayerTimesForDate = getPrayerTimesForDate as jest.MockedFunction<
  typeof getPrayerTimesForDate
>;
const mockGetDayStatuses = getDayStatuses as jest.MockedFunction<
  typeof getDayStatuses
>;

function makePrefs(enabled = true) {
  return {
    Fajr: enabled,
    Sunrise: enabled,
    Dhuhr: enabled,
    Asr: enabled,
    Maghrib: enabled,
    Isha: enabled,
  };
}

const NO_WINDOW = { Fajr: false, Dhuhr: false, Asr: false, Maghrib: false };

const FULL_DAY = [
  { label: "Fajr", time: "05:00 AM" },
  { label: "Sunrise", time: "06:30 AM" },
  { label: "Dhuhr", time: "01:00 PM" },
  { label: "Asr", time: "05:30 PM" },
  { label: "Maghrib", time: "08:30 PM" },
  { label: "Isha", time: "10:00 PM" },
];

describe("notifications/scheduler", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    mockGetDayStatuses.mockResolvedValue({});
  });

  it("formats yyyymmdd deterministically", () => {
    expect(yyyymmdd(new Date(2026, 1, 3, 10, 11, 12))).toBe("2026-02-03");
  });

  it("computes ms until next local midnight plus offset", () => {
    freezeTestTime(new Date(2026, 0, 1, 23, 59, 0));
    const ms = msUntilNextLocalMidnightPlus(5);
    expect(ms).toBeGreaterThanOrEqual(1000);
    expect(ms).toBeLessThanOrEqual(6 * 60 * 1000);
    resetTestTime();
  });

  it("cancels all existing schedules and clears tracking storage", async () => {
    const cancelAll = Notifications.cancelAllScheduledNotificationsAsync as jest.Mock;
    const cancelOne = Notifications.cancelScheduledNotificationAsync as jest.Mock;

    await AsyncStorage.setItem(STORAGE_SCHEDULE_IDS, JSON.stringify(["id-a", "id-b"]));
    await AsyncStorage.setItem(STORAGE_SEEN_KEYS, JSON.stringify(["Fajr_2026-01-01T05:00"]));

    await cancelPreviouslyScheduled();

    expect(cancelAll).toHaveBeenCalledTimes(1);
    expect(cancelOne).toHaveBeenCalledTimes(2);
    expect(cancelOne).toHaveBeenCalledWith("id-a");
    expect(cancelOne).toHaveBeenCalledWith("id-b");
    await expect(AsyncStorage.getItem(STORAGE_SCHEDULE_IDS)).resolves.toBeNull();
    await expect(AsyncStorage.getItem(STORAGE_SEEN_KEYS)).resolves.toBeNull();
  });

  it("prevents duplicate notifications across repeated schedule passes", async () => {
    const scheduleNotificationAsync = Notifications.scheduleNotificationAsync as jest.Mock;
    freezeTestTime(new Date(2026, 0, 1, 4, 0, 0));
    mockGetPrayerTimesForDate.mockResolvedValue([
      { label: "Fajr", time: "05:00 AM" },
    ] as any);

    const params = {
      days: 1,
      prefs: makePrefs(true),
      cityDisplay: "Chicago",
      effective: { useLocation: true, method: 2, city: undefined },
      soundMode: "default" as const,
      windowPrefs: NO_WINDOW,
      windowOffset: 15,
      fridayEnabled: false,
    };

    await scheduleForHorizon(params);
    await scheduleForHorizon(params);

    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    resetTestTime();
  });

  it("skips past prayer times", async () => {
    const scheduleNotificationAsync = Notifications.scheduleNotificationAsync as jest.Mock;
    freezeTestTime(new Date(2026, 0, 1, 6, 0, 0));
    mockGetPrayerTimesForDate.mockResolvedValue([
      { label: "Fajr", time: "05:00 AM" },
    ] as any);

    await scheduleForHorizon({
      days: 1,
      prefs: makePrefs(true),
      cityDisplay: "Chicago",
      effective: { useLocation: true, method: 2, city: undefined },
      soundMode: "default",
      windowPrefs: NO_WINDOW,
      windowOffset: 15,
      fridayEnabled: false,
    });

    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
    resetTestTime();
  });

  it("schedules a window reminder offset before the next prayer for an unlogged prayer", async () => {
    const scheduleNotificationAsync = Notifications.scheduleNotificationAsync as jest.Mock;
    freezeTestTime(new Date(2026, 0, 1, 4, 0, 0));
    mockGetPrayerTimesForDate.mockResolvedValue(FULL_DAY as any);

    await scheduleForHorizon({
      days: 1,
      prefs: makePrefs(false),
      cityDisplay: "Chicago",
      effective: { useLocation: true, method: 2, city: undefined },
      soundMode: "default",
      windowPrefs: { Fajr: false, Dhuhr: true, Asr: false, Maghrib: false },
      windowOffset: 15,
      fridayEnabled: false,
    });

    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const arg = scheduleNotificationAsync.mock.calls[0][0];
    expect(arg.content.title).toBe("Dhuhr ending soon");
    expect(arg.content.body).toBe("Asr begins at 05:30 PM, in 15 min.");
    expect(arg.content.data.type).toBe("window_reminder");
    // Asr 5:30 PM minus 15 min = 5:15 PM.
    expect(new Date(arg.trigger.date).getHours()).toBe(17);
    expect(new Date(arg.trigger.date).getMinutes()).toBe(15);
    resetTestTime();
  });

  it("plays the adhan only for prayer alerts; Sunrise and window reminders use the system sound", async () => {
    const scheduleNotificationAsync = Notifications.scheduleNotificationAsync as jest.Mock;
    freezeTestTime(new Date(2026, 0, 1, 4, 0, 0));
    mockGetPrayerTimesForDate.mockResolvedValue(FULL_DAY as any);

    await scheduleForHorizon({
      days: 1,
      prefs: { ...makePrefs(false), Sunrise: true, Dhuhr: true },
      cityDisplay: "Chicago",
      effective: { useLocation: true, method: 2, city: undefined },
      soundMode: "adhan",
      windowPrefs: { Fajr: false, Dhuhr: true, Asr: false, Maghrib: false },
      windowOffset: 15,
      fridayEnabled: false,
    });

    const sounds = Object.fromEntries(
      scheduleNotificationAsync.mock.calls.map(([arg]) => [arg.content.title, arg.content.sound]),
    );
    expect(sounds).toEqual({
      "🌞 Sunrise time": "default",
      "☀️ Dhuhr time": "adhan.caf",
      "Dhuhr ending soon": "default",
    });
    resetTestTime();
  });

  it("does not schedule a window reminder when the prayer is already logged", async () => {
    const scheduleNotificationAsync = Notifications.scheduleNotificationAsync as jest.Mock;
    freezeTestTime(new Date(2026, 0, 1, 4, 0, 0));
    mockGetPrayerTimesForDate.mockResolvedValue(FULL_DAY as any);
    mockGetDayStatuses.mockResolvedValue({ dhuhr: "missed" });

    await scheduleForHorizon({
      days: 1,
      prefs: makePrefs(false),
      cityDisplay: "Chicago",
      effective: { useLocation: true, method: 2, city: undefined },
      soundMode: "default",
      windowPrefs: { Fajr: false, Dhuhr: true, Asr: false, Maghrib: false },
      windowOffset: 15,
      fridayEnabled: false,
    });

    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
    resetTestTime();
  });

  it("uses Sunrise as Fajr's boundary with 'is at' phrasing", async () => {
    const scheduleNotificationAsync = Notifications.scheduleNotificationAsync as jest.Mock;
    freezeTestTime(new Date(2026, 0, 1, 4, 0, 0));
    mockGetPrayerTimesForDate.mockResolvedValue(FULL_DAY as any);

    await scheduleForHorizon({
      days: 1,
      prefs: makePrefs(false),
      cityDisplay: "Chicago",
      effective: { useLocation: true, method: 2, city: undefined },
      soundMode: "default",
      windowPrefs: { Fajr: true, Dhuhr: false, Asr: false, Maghrib: false },
      windowOffset: 15,
      fridayEnabled: false,
    });

    const arg = scheduleNotificationAsync.mock.calls[0][0];
    expect(arg.content.title).toBe("Fajr ending soon");
    expect(arg.content.body).toBe("Sunrise is at 06:30 AM, in 15 min.");
    resetTestTime();
  });

  it("never schedules a window reminder for Isha", async () => {
    const scheduleNotificationAsync = Notifications.scheduleNotificationAsync as jest.Mock;
    freezeTestTime(new Date(2026, 0, 1, 4, 0, 0));
    mockGetPrayerTimesForDate.mockResolvedValue(FULL_DAY as any);

    await scheduleForHorizon({
      days: 1,
      prefs: makePrefs(false),
      cityDisplay: "Chicago",
      effective: { useLocation: true, method: 2, city: undefined },
      soundMode: "default",
      windowPrefs: { Fajr: false, Dhuhr: false, Asr: false, Maghrib: true },
      windowOffset: 15,
      fridayEnabled: false,
    });

    // Maghrib reminder (before Isha) is allowed; assert no reminder titled "Isha ending soon".
    const titles = scheduleNotificationAsync.mock.calls.map(
      (c) => c[0].content.title,
    );
    expect(titles).toContain("Maghrib ending soon");
    expect(titles).not.toContain("Isha ending soon");
    expect(titles.filter((t) => typeof t === "string" && t.endsWith("ending soon"))).toEqual(["Maghrib ending soon"]);
    resetTestTime();
  });

  it("sorts candidates by fire time and caps the total at the pending budget", async () => {
    const scheduleNotificationAsync = Notifications.scheduleNotificationAsync as jest.Mock;
    freezeTestTime(new Date(2026, 0, 1, 0, 0, 0));
    mockGetPrayerTimesForDate.mockResolvedValue(FULL_DAY as any);

    await scheduleForHorizon({
      days: 15, // 15 days x 6 prayers = 90 at-prayer candidates, over the 60 budget
      prefs: makePrefs(true),
      cityDisplay: "Chicago",
      effective: { useLocation: true, method: 2, city: undefined },
      soundMode: "default",
      windowPrefs: NO_WINDOW,
      windowOffset: 15,
      fridayEnabled: false,
    });

    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(60);
    // First scheduled is the soonest (today's Fajr, 05:00 today).
    const firstDate = new Date(
      scheduleNotificationAsync.mock.calls[0][0].trigger.date,
    );
    const lastDate = new Date(
      scheduleNotificationAsync.mock.calls[59][0].trigger.date,
    );
    expect(firstDate.getTime()).toBeLessThan(lastDate.getTime());
    expect(firstDate.getHours()).toBe(5);
    resetTestTime();
  });

  describe("friday reminder", () => {
    // 2026-01-01 is a Thursday, so Jan 2, 9 and 16 are Fridays.
    const baseParams = {
      prefs: makePrefs(false),
      cityDisplay: "Chicago",
      effective: { useLocation: true, method: 2, city: undefined },
      soundMode: "default" as const,
      windowPrefs: NO_WINDOW,
      windowOffset: 15,
      fridayEnabled: true,
    };

    const fridayCalls = () =>
      (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls
        .map(([arg]) => arg)
        .filter((arg) => arg.content.data?.type === "friday");

    beforeEach(() => {
      mockGetPrayerTimesForDate.mockResolvedValue([] as any);
    });

    afterEach(() => resetTestTime());

    it("schedules one candidate per Friday between 9:00 and 11:00 local, none on other days", async () => {
      freezeTestTime(new Date(2026, 0, 1, 0, 0, 0));

      await scheduleForHorizon({ ...baseParams, days: 16 });

      const calls = fridayCalls();
      expect(calls).toHaveLength(3);
      const dates = calls.map((c) => new Date(c.trigger.date));
      expect(dates.map((d) => d.getDate())).toEqual([2, 9, 16]);
      dates.forEach((d) => {
        expect(d.getDay()).toBe(5);
        expect([9, 10]).toContain(d.getHours());
      });
      expect(calls[0].content).toEqual(
        expect.objectContaining({
          title: "Jumu'ah Mubarak",
          sound: "default",
          data: { type: "friday", url: "/Quran?surah=18&ayah=1" },
        }),
      );
      expect(FRIDAY_MESSAGES).toContain(calls[0].content.body);
    });

    it("uses the same time and text for a given Friday on every pass", async () => {
      freezeTestTime(new Date(2026, 0, 1, 0, 0, 0));
      await scheduleForHorizon({ ...baseParams, days: 3 });
      const first = fridayCalls()[0];

      jest.clearAllMocks();
      await AsyncStorage.clear();
      await scheduleForHorizon({ ...baseParams, days: 3 });
      const second = fridayCalls()[0];

      expect(second.trigger.date).toEqual(first.trigger.date);
      expect(second.content.body).toBe(first.content.body);
    });

    it("skips a Friday whose reminder time has already passed", async () => {
      freezeTestTime(new Date(2026, 0, 2, 11, 30, 0));

      await scheduleForHorizon({ ...baseParams, days: 1 });

      expect(fridayCalls()).toHaveLength(0);
    });

    it("schedules today's reminder when it is still ahead", async () => {
      freezeTestTime(new Date(2026, 0, 2, 8, 0, 0));

      await scheduleForHorizon({ ...baseParams, days: 1 });

      expect(fridayCalls()).toHaveLength(1);
    });

    it("schedules nothing when the toggle is off", async () => {
      freezeTestTime(new Date(2026, 0, 1, 0, 0, 0));

      await scheduleForHorizon({ ...baseParams, days: 16, fridayEnabled: false });

      expect(fridayCalls()).toHaveLength(0);
    });

    it("does not duplicate across repeated passes", async () => {
      freezeTestTime(new Date(2026, 0, 1, 0, 0, 0));

      await scheduleForHorizon({ ...baseParams, days: 3 });
      await scheduleForHorizon({ ...baseParams, days: 3 });

      expect(fridayCalls()).toHaveLength(1);
    });

    it("shares the pending budget with prayer alerts", async () => {
      const scheduleNotificationAsync = Notifications.scheduleNotificationAsync as jest.Mock;
      freezeTestTime(new Date(2026, 0, 1, 0, 0, 0));
      mockGetPrayerTimesForDate.mockResolvedValue(FULL_DAY as any);

      await scheduleForHorizon({ ...baseParams, prefs: makePrefs(true), days: 15 });

      expect(scheduleNotificationAsync).toHaveBeenCalledTimes(60);
      expect(fridayCalls().length).toBeGreaterThan(0);
    });
  });
});
