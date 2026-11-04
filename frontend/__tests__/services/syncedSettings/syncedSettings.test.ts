import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  allSyncedSettings,
  duaSavedSetting,
  notifFridaySetting,
  notifPrefsSetting,
  notifSoundModeSetting,
  notifWindowMapSetting,
  notifWindowOffsetSetting,
  quranBookmarksSetting,
  quranDisplayModesSetting,
  quranProgressSetting,
  quranReciterSetting,
  ramadanModeSetting,
  ramadanTrackerSetting,
  subscribeToAllSettings,
  themeSetting,
} from "@/services/syncedSettings";
import { getSettingsMeta } from "@/services/sync/settingsMeta";

beforeEach(async () => {
  await AsyncStorage.clear();
});

it("declares exactly the synced setting keys", () => {
  expect(allSyncedSettings().map((s) => s.key).sort()).toEqual([
    "duaSaved",
    "notifFriday",
    "notifPrefs",
    "notifSoundMode",
    "notifWindowMap",
    "notifWindowOffset",
    "prayerSettings",
    "quranBookmarks",
    "quranDisplayModes",
    "quranProgress",
    "quranReciter",
    "ramadanMode",
    "ramadanTracker",
    "theme",
  ]);
});

describe("set (a user edit)", () => {
  it("persists, stamps, and notifies once with source local", async () => {
    const perSetting = jest.fn();
    const all = jest.fn();
    themeSetting.subscribe(perSetting);
    const off = subscribeToAllSettings(all);

    await themeSetting.set("dark");

    expect(await AsyncStorage.getItem("app_theme_v1")).toBe("dark");
    expect((await getSettingsMeta()).theme).toBeGreaterThan(0);
    expect(perSetting).toHaveBeenCalledTimes(1);
    expect(perSetting).toHaveBeenCalledWith("dark", "local");
    expect(all).toHaveBeenCalledWith("theme", "local");
    off();
  });

  it("does not stamp or persist a value the codec rejects", async () => {
    await notifSoundModeSetting.set("bogus" as never);
    expect(await AsyncStorage.getItem("notif_sound_mode_v1")).toBeNull();
    expect((await getSettingsMeta()).notifSoundMode).toBeUndefined();
  });
});

describe("applyRemote (a value from another device)", () => {
  it("persists and notifies with source remote, but never stamps", async () => {
    const listener = jest.fn();
    notifSoundModeSetting.subscribe(listener);

    expect(await notifSoundModeSetting.applyRemote("adhan")).toBe(true);

    expect(await notifSoundModeSetting.get()).toBe("adhan");
    expect(listener).toHaveBeenCalledWith("adhan", "remote");
    expect((await getSettingsMeta()).notifSoundMode).toBeUndefined();
  });

  it("ignores malformed remote values", async () => {
    expect(await notifSoundModeSetting.applyRemote("bogus")).toBe(false);
    expect(await notifSoundModeSetting.get()).toBe("default");
    await notifWindowOffsetSetting.applyRemote(7);
    expect(await notifWindowOffsetSetting.get()).toBe(15);
    await notifFridaySetting.applyRemote("nope");
    expect(await notifFridaySetting.get()).toBe(true);
    await quranReciterSetting.applyRemote("sudais");
    await quranReciterSetting.applyRemote("not-a-reciter");
    expect(await quranReciterSetting.get()).toBe("sudais");
  });
});

describe("codecs", () => {
  it("round-trip each setting's values and defaults", async () => {
    expect(await ramadanModeSetting.get()).toBe(true);
    await ramadanModeSetting.set(false);
    expect(await AsyncStorage.getItem("ramadan_mode_v1")).toBe("0");
    expect(await ramadanModeSetting.get()).toBe(false);

    await notifPrefsSetting.applyRemote({ Fajr: false, Dhuhr: true, junk: 1 });
    expect(await notifPrefsSetting.get()).toMatchObject({ Fajr: false, Dhuhr: true });

    await notifWindowMapSetting.applyRemote({ Fajr: true, Asr: true });
    expect(await notifWindowMapSetting.get()).toMatchObject({ Fajr: true, Asr: true });

    await notifWindowOffsetSetting.set(30);
    expect(await AsyncStorage.getItem("notif_window_offset_v1")).toBe("30");
    expect(await notifWindowOffsetSetting.get()).toBe(30);

    await duaSavedSetting.applyRemote([3, 3, "x", 4]);
    expect(await duaSavedSetting.get()).toEqual([3, 4]);

    await quranDisplayModesSetting.applyRemote(["english", "english", "bogus"]);
    expect(await quranDisplayModesSetting.get()).toEqual(["english"]);

    await ramadanTrackerSetting.applyRemote({ "2026-03-01": true, "2026-03-02": false });
    expect(await ramadanTrackerSetting.get()).toEqual({ "2026-03-01": true });
  });

  it("falls back to the default for corrupt stored data", async () => {
    await AsyncStorage.setItem("notif_map_v1", "{not json");
    expect(await notifPrefsSetting.get()).toMatchObject({ Fajr: true });
    await AsyncStorage.setItem("quran_reciter_v1", "bogus");
    expect(await quranReciterSetting.get()).toBe("alafasy");
  });

  it("keeps reading progress in its two existing storage keys", async () => {
    await quranProgressSetting.set({ index: 41, position: { surahNumber: 2, ayahNumber: 3 } });
    expect(await AsyncStorage.getItem("quran:last-read:index")).toBe("41");
    expect(JSON.parse((await AsyncStorage.getItem("quran:last-read:position"))!)).toEqual({
      surahNumber: 2,
      ayahNumber: 3,
    });

    await AsyncStorage.clear();
    await AsyncStorage.setItem("quran:last-read:index", "7");
    expect(await quranProgressSetting.get()).toEqual({ index: 7, position: null });
  });

  it("sorts bookmarks newest first and drops malformed entries", async () => {
    const base = { surahNumber: 1, ayahNumber: 1, ayahGlobalIndex: 0, createdAt: 1 };
    await quranBookmarksSetting.applyRemote([
      { ...base, id: "a", title: "old", updatedAt: 1 },
      { ...base, id: "b", title: "new", updatedAt: 9 },
      { id: "c", title: "" },
    ]);
    expect((await quranBookmarksSetting.get()).map((b) => b.id)).toEqual(["b", "a"]);
  });
});

it("peek returns the last value seen", async () => {
  await themeSetting.set("light");
  expect(themeSetting.peek()).toBe("light");
  await AsyncStorage.clear();
  expect(await themeSetting.get()).toBe("default");
  expect(themeSetting.peek()).toBe("default");
});
