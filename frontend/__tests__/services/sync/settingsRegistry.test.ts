import AsyncStorage from "@react-native-async-storage/async-storage";
import { SETTINGS_REGISTRY } from "@/services/sync/settingsRegistry";

beforeEach(async () => { await AsyncStorage.clear(); });

it("covers exactly the synced setting keys", () => {
  expect(SETTINGS_REGISTRY.map((e) => e.key).sort()).toEqual(
    [
      "notifPrefs",
      "notifSoundMode",
      "notifWindowMap",
      "notifWindowOffset",
      "prayerSettings",
      "quranBookmarks",
      "quranDisplayModes",
      "quranProgress",
      "ramadanTracker",
      "theme",
    ],
  );
});

it("each notif entry stamps off its own granular change event", () => {
  const eventByKey = Object.fromEntries(
    SETTINGS_REGISTRY.map((e) => [e.key, e.changeEvent]),
  );
  expect(eventByKey.notifPrefs).toBe("NOTIF_MAP_CHANGED");
  expect(eventByKey.notifSoundMode).toBe("NOTIF_SOUND_MODE_CHANGED");
  expect(eventByKey.notifWindowMap).toBe("NOTIF_WINDOW_MAP_CHANGED");
  expect(eventByKey.notifWindowOffset).toBe("NOTIF_WINDOW_OFFSET_CHANGED");
});

it("theme entry round-trips value via read/applyValue", async () => {
  const theme = SETTINGS_REGISTRY.find((e) => e.key === "theme")!;
  await theme.applyValue("dark");
  expect(await theme.read()).toBe("dark");
});

it("notif entries round-trip values via read/applyValue", async () => {
  const byKey = Object.fromEntries(SETTINGS_REGISTRY.map((e) => [e.key, e]));

  await byKey.notifPrefs.applyValue({ Fajr: false, Dhuhr: true });
  expect(await byKey.notifPrefs.read()).toMatchObject({ Fajr: false, Dhuhr: true });

  await byKey.notifSoundMode.applyValue("adhan");
  expect(await byKey.notifSoundMode.read()).toBe("adhan");

  await byKey.notifWindowMap.applyValue({ Fajr: true, Asr: true });
  expect(await byKey.notifWindowMap.read()).toMatchObject({ Fajr: true, Asr: true });

  await byKey.notifWindowOffset.applyValue(30);
  expect(await byKey.notifWindowOffset.read()).toBe(30);
});

it("notif applyValue ignores malformed remote values", async () => {
  const byKey = Object.fromEntries(SETTINGS_REGISTRY.map((e) => [e.key, e]));

  await byKey.notifSoundMode.applyValue("bogus");
  expect(await byKey.notifSoundMode.read()).toBe("default");

  await byKey.notifWindowOffset.applyValue(7);
  expect(await byKey.notifWindowOffset.read()).toBe(15);
});
