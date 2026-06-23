import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import {
  cancelPreviouslyScheduled,
  msUntilNextLocalMidnightPlus,
  scheduleForHorizon,
  yyyymmdd,
} from "@/services/notifications/scheduler";
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
    });

    // Maghrib reminder (before Isha) is allowed; assert no reminder titled "Isha ending soon".
    const titles = scheduleNotificationAsync.mock.calls.map(
      (c) => c[0].content.title,
    );
    expect(titles).toContain("Maghrib ending soon");
    expect(titles).not.toContain("Isha ending soon");
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
});
