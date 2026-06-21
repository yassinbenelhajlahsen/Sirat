import AsyncStorage from "@react-native-async-storage/async-storage";
import { SETTINGS_META_KEY, getSettingsMeta, bumpStamp, setStamp } from "@/services/sync/settingsMeta";

beforeEach(async () => { await AsyncStorage.clear(); });

it("returns {} when nothing stored", async () => {
  expect(await getSettingsMeta()).toEqual({});
});

it("bumpStamp writes the provided time", async () => {
  await bumpStamp("theme", 123);
  expect(await getSettingsMeta()).toEqual({ theme: 123 });
  expect(JSON.parse((await AsyncStorage.getItem(SETTINGS_META_KEY))!)).toEqual({ theme: 123 });
});

it("setStamp overwrites a key without touching others", async () => {
  await bumpStamp("theme", 100);
  await bumpStamp("prayerSettings", 200);
  await setStamp("theme", 999);
  expect(await getSettingsMeta()).toEqual({ theme: 999, prayerSettings: 200 });
});
