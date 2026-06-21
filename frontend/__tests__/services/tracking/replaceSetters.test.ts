import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";
import {
  replacePrayerLog, getCachedPrayerLog, PRAYER_LOG_STORAGE_KEY, PRAYER_LOG_UPDATED_EVENT,
} from "@/services/tracking/prayerLog";
import { replaceAllHabits, HABITS_STORAGE_KEY, HABITS_UPDATED_EVENT } from "@/services/tracking/habits";
import {
  replaceHabitLog, getCachedHabitLog, HABIT_LOG_STORAGE_KEY, HABIT_LOG_UPDATED_EVENT,
} from "@/services/tracking/habitLog";

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

it("replacePrayerLog persists, updates cache, and emits", async () => {
  const emit = jest.spyOn(DeviceEventEmitter, "emit");
  const log = { "2026-06-20": { fajr: { value: "prayed" as const, updatedAt: 1 } } };
  await replacePrayerLog(log);
  expect(JSON.parse((await AsyncStorage.getItem(PRAYER_LOG_STORAGE_KEY))!)).toEqual(log);
  expect(getCachedPrayerLog()).toEqual(log);
  expect(emit).toHaveBeenCalledWith(PRAYER_LOG_UPDATED_EVENT, { dateKey: null });
});

it("replaceAllHabits persists and emits", async () => {
  const emit = jest.spyOn(DeviceEventEmitter, "emit");
  const habits = [{ id: "h1", name: "A", icon: "i", frequency: { type: "daily" as const }, order: 0, archived: false, createdAtKey: "2026-06-01", updatedAt: 1 }];
  await replaceAllHabits(habits);
  expect(JSON.parse((await AsyncStorage.getItem(HABITS_STORAGE_KEY))!)).toEqual(habits);
  expect(emit).toHaveBeenCalledWith(HABITS_UPDATED_EVENT);
});

it("replaceHabitLog persists, updates cache, and emits", async () => {
  const emit = jest.spyOn(DeviceEventEmitter, "emit");
  const log = { "2026-06-20": { h1: { value: true, updatedAt: 1 } } };
  await replaceHabitLog(log);
  expect(JSON.parse((await AsyncStorage.getItem(HABIT_LOG_STORAGE_KEY))!)).toEqual(log);
  expect(getCachedHabitLog()).toEqual(log);
  expect(emit).toHaveBeenCalledWith(HABIT_LOG_UPDATED_EVENT, { dateKey: null });
});
