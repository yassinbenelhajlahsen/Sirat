import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import {
  STORAGE_DAYKEY,
  STORAGE_SCHEDULE_IDS,
  STORAGE_SEEN_KEYS,
  HORIZON_DAYS,
} from "@/services/notifications/constants";
import {
  applySchedule,
  cancelPreviouslyScheduled,
  msUntilNextLocalMidnightPlus,
  readPlanInputs,
} from "@/services/notifications/scheduler";
import { buildPrayerDay } from "@/services/prayerDay";
import type { PlanInput } from "@/services/notifications/planner";
import { notifPrefsSetting, notifSoundModeSetting } from "@/services/syncedSettings";

jest.mock("@/services/prayerTimes", () => ({ getPrayerTimesForDate: jest.fn() }));
jest.mock("@/services/prayerSettings", () => ({
  getEffectivePrayerSettings: jest.fn(async () => ({ useLocation: false, method: 2, city: { name: "Chicago", country: "US", lat: 1, lng: 2 } })),
}));
jest.mock("@/services/tracking/prayerLog", () => ({ getDayStatuses: jest.fn(async () => ({})) }));
jest.mock("@/services/notifications/cityResolver", () => ({ resolveCityDisplay: jest.fn(async () => "Chicago") }));

import { getPrayerTimesForDate } from "@/services/prayerTimes";
import { getDayStatuses } from "@/services/tracking/prayerLog";

const schedule = Notifications.scheduleNotificationAsync as jest.Mock;
const cancelAll = Notifications.cancelAllScheduledNotificationsAsync as jest.Mock;

const allPrefs = (on: boolean) => ({ Fajr: on, Sunrise: on, Dhuhr: on, Asr: on, Maghrib: on, Isha: on });
const NO_WINDOW = { Fajr: false, Dhuhr: false, Asr: false, Maghrib: false };
const FULL_DAY = [
  { label: "Fajr", time: "5:00 AM" },
  { label: "Sunrise", time: "6:30 AM" },
  { label: "Dhuhr", time: "1:00 PM" },
  { label: "Asr", time: "5:30 PM" },
  { label: "Maghrib", time: "8:30 PM" },
  { label: "Isha", time: "10:00 PM" },
];

function inputs(count: number, over: Partial<Omit<PlanInput, "now" | "seen" | "budget">> = {}) {
  return {
    days: Array.from({ length: count }, (_, i) => {
      const date = new Date(2026, 0, 1 + i);
      return { date, prayerDay: buildPrayerDay(date, FULL_DAY), statuses: {}, fasting: false };
    }),
    cityDisplay: "Chicago",
    prefs: allPrefs(true),
    windowPrefs: NO_WINDOW,
    windowOffset: 15,
    fridayEnabled: false,
    prayerSound: "default",
    ...over,
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe("notifications/scheduler helpers", () => {
  it("computes ms until next local midnight plus offset", () => {
    freezeTestTime(new Date(2026, 0, 1, 23, 59, 0));
    const ms = msUntilNextLocalMidnightPlus(5);
    expect(ms).toBeGreaterThanOrEqual(1000);
    expect(ms).toBeLessThanOrEqual(6 * 60 * 1000);
    resetTestTime();
  });

  it("cancels all existing schedules and clears tracking storage", async () => {
    const cancelOne = Notifications.cancelScheduledNotificationAsync as jest.Mock;
    await AsyncStorage.setItem(STORAGE_SCHEDULE_IDS, JSON.stringify(["id-a", "id-b"]));
    await AsyncStorage.setItem(STORAGE_SEEN_KEYS, JSON.stringify(["Fajr_2026-01-01T05:00"]));

    await cancelPreviouslyScheduled();

    expect(cancelAll).toHaveBeenCalledTimes(1);
    expect(cancelOne).toHaveBeenCalledWith("id-a");
    expect(cancelOne).toHaveBeenCalledWith("id-b");
    await expect(AsyncStorage.getItem(STORAGE_SCHEDULE_IDS)).resolves.toBeNull();
    await expect(AsyncStorage.getItem(STORAGE_SEEN_KEYS)).resolves.toBeNull();
  });
});

describe("applySchedule", () => {
  beforeEach(() => freezeTestTime(new Date(2026, 0, 1, 4, 0, 0)));
  afterEach(() => resetTestTime());

  it("schedules every planned notification at its time with high priority, and records them", async () => {
    await applySchedule(inputs(1, { prefs: { ...allPrefs(false), Fajr: true } }));

    expect(schedule).toHaveBeenCalledTimes(1);
    const arg = schedule.mock.calls[0][0];
    expect(arg.content).toEqual(
      expect.objectContaining({ title: "🌅 Fajr time", body: "5:00 AM in Chicago", sound: "default", priority: Notifications.AndroidNotificationPriority.HIGH }),
    );
    expect(arg.trigger).toEqual({ type: "date", date: new Date(2026, 0, 1, 5, 0) });
    expect(JSON.parse((await AsyncStorage.getItem(STORAGE_SCHEDULE_IDS))!)).toHaveLength(1);
    expect(JSON.parse((await AsyncStorage.getItem(STORAGE_SEEN_KEYS))!)).toHaveLength(1);
    expect(await AsyncStorage.getItem(STORAGE_DAYKEY)).toBeTruthy();
  });

  it("does nothing the second time when nothing changed", async () => {
    await applySchedule(inputs(2));
    const first = schedule.mock.calls.length;
    cancelAll.mockClear();

    await applySchedule(inputs(2));

    expect(schedule).toHaveBeenCalledTimes(first);
    expect(cancelAll).not.toHaveBeenCalled();
  });

  it("replaces everything pending when something that affects a notification changed", async () => {
    await applySchedule(inputs(1));
    schedule.mockClear();
    cancelAll.mockClear();

    await applySchedule(inputs(1, { prefs: { ...allPrefs(true), Asr: false } }));

    expect(cancelAll).toHaveBeenCalledTimes(1);
    const titles = schedule.mock.calls.map(([a]) => a.content.title);
    expect(titles).not.toContain("🕔 Asr time");
    expect(titles).toContain("🌅 Fajr time");
  });

  it("only adds what is new as time passes, without cancelling", async () => {
    await applySchedule(inputs(1));
    const before = schedule.mock.calls.length;
    freezeTestTime(new Date(2026, 0, 1, 12, 0, 0));
    cancelAll.mockClear();

    await applySchedule(inputs(1));

    expect(cancelAll).not.toHaveBeenCalled();
    expect(schedule).toHaveBeenCalledTimes(before);
  });

  it("caps pending notifications at 60, soonest first, counting what is already scheduled", async () => {
    await applySchedule(inputs(15));
    expect(schedule).toHaveBeenCalledTimes(60);
    expect(new Date(schedule.mock.calls[0][0].trigger.date).getHours()).toBe(5);

    schedule.mockClear();
    await applySchedule(inputs(15));
    expect(schedule).not.toHaveBeenCalled();
  });
});

describe("readPlanInputs", () => {
  it("gathers settings, a full horizon of days with times and marks, and the platform sound", async () => {
    const day = buildPrayerDay(new Date(), FULL_DAY);
    (getPrayerTimesForDate as jest.Mock).mockResolvedValue(day);
    (getDayStatuses as jest.Mock).mockResolvedValue({ Fajr: "prayed" });
    await notifPrefsSetting.set({ ...allPrefs(true), Isha: false });
    await notifSoundModeSetting.set("adhan");

    const result = await readPlanInputs();

    expect(result.days).toHaveLength(HORIZON_DAYS);
    expect(result.days[0]).toEqual(expect.objectContaining({ prayerDay: day, statuses: { Fajr: "prayed" }, fasting: false }));
    expect(result.prefs.Isha).toBe(false);
    expect(result.cityDisplay).toBe("Chicago");
    expect(result.prayerSound).toBe("adhan.caf");
    expect(result.windowOffset).toBe(15);
  });
});
