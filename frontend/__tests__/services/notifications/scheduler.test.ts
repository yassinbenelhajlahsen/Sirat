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

import { getPrayerTimesForDate } from "@/services/prayerTimes";

const mockGetPrayerTimesForDate = getPrayerTimesForDate as jest.MockedFunction<
  typeof getPrayerTimesForDate
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

describe("notifications/scheduler", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
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
    };

    await scheduleForHorizon(params);
    await scheduleForHorizon(params);

    expect(scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const savedIds = JSON.parse((await AsyncStorage.getItem(STORAGE_SCHEDULE_IDS)) || "[]");
    expect(savedIds).toEqual(["notif-id-1"]);

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
    });

    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
    resetTestTime();
  });
});
