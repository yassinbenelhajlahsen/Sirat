import AsyncStorage from "@react-native-async-storage/async-storage";
import { SETTINGS_REGISTRY } from "@/services/sync/settingsRegistry";

beforeEach(async () => { await AsyncStorage.clear(); });

it("covers exactly the synced setting keys", () => {
  expect(SETTINGS_REGISTRY.map((e) => e.key).sort()).toEqual(
    [
      "duaSaved",
      "notifFriday",
      "notifPrefs",
      "notifSoundMode",
      "notifSuhoor",
      "notifSuhoorOffset",
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
  expect(eventByKey.notifFriday).toBe("NOTIF_FRIDAY_CHANGED");
  expect(eventByKey.notifSuhoor).toBe("NOTIF_SUHOOR_CHANGED");
  expect(eventByKey.notifSuhoorOffset).toBe("NOTIF_SUHOOR_OFFSET_CHANGED");
  expect(eventByKey.ramadanMode).toBe("RAMADAN_MODE_CHANGED");
});

it("ramadan and suhoor entries default sensibly and round-trip values", async () => {
  const byKey = Object.fromEntries(SETTINGS_REGISTRY.map((e) => [e.key, e]));

  expect(await byKey.ramadanMode.read()).toBe(true);
  expect(await byKey.notifSuhoor.read()).toBe(false);
  expect(await byKey.notifSuhoorOffset.read()).toBe(30);

  await byKey.ramadanMode.applyValue(false);
  expect(await byKey.ramadanMode.read()).toBe(false);
  await byKey.notifSuhoor.applyValue(true);
  expect(await byKey.notifSuhoor.read()).toBe(true);
  await byKey.notifSuhoorOffset.applyValue(45);
  expect(await byKey.notifSuhoorOffset.read()).toBe(45);

  await byKey.notifSuhoorOffset.applyValue(7);
  expect(await byKey.notifSuhoorOffset.read()).toBe(45);
  await byKey.ramadanMode.applyValue("yes");
  expect(await byKey.ramadanMode.read()).toBe(false);
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

  expect(await byKey.notifFriday.read()).toBe(true);
  await byKey.notifFriday.applyValue(false);
  expect(await byKey.notifFriday.read()).toBe(false);
  await byKey.notifFriday.applyValue(true);
  expect(await byKey.notifFriday.read()).toBe(true);
});

it("notif applyValue ignores malformed remote values", async () => {
  const byKey = Object.fromEntries(SETTINGS_REGISTRY.map((e) => [e.key, e]));

  await byKey.notifSoundMode.applyValue("bogus");
  expect(await byKey.notifSoundMode.read()).toBe("default");

  await byKey.notifWindowOffset.applyValue(7);
  expect(await byKey.notifWindowOffset.read()).toBe(15);

  await byKey.notifFriday.applyValue("nope");
  expect(await byKey.notifFriday.read()).toBe(true);
});

it("quranReciter entry stamps off its own event and ignores unknown ids", async () => {
  const entry = SETTINGS_REGISTRY.find((e) => e.key === "quranReciter")!;
  expect(entry.changeEvent).toBe("QURAN_RECITER_UPDATED");

  await entry.applyValue("sudais");
  expect(await entry.read()).toBe("sudais");

  await entry.applyValue("nope");
  expect(await entry.read()).toBe("sudais");
});
