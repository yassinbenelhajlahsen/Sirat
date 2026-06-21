import AsyncStorage from "@react-native-async-storage/async-storage";
import { settingsAdapter } from "@/services/sync/adapters/settingsAdapter";
import { bumpStamp, getSettingsMeta } from "@/services/sync/settingsMeta";
import { APP_THEME_STORAGE_KEY } from "@/constants/theme";

beforeEach(async () => { await AsyncStorage.clear(); });

it("read() builds an envelope with stamps from meta (0 when unstamped)", async () => {
  await AsyncStorage.setItem(APP_THEME_STORAGE_KEY, "dark");
  await bumpStamp("theme", 500);
  const env = await settingsAdapter.read();
  expect(env.theme).toEqual({ value: "dark", updatedAt: 500 });
  expect(env.prayerSettings.updatedAt).toBe(0);
});

it("applyMerged writes a newer remote value and records its stamp", async () => {
  await AsyncStorage.setItem(APP_THEME_STORAGE_KEY, "light");
  await bumpStamp("theme", 100);
  await settingsAdapter.applyMerged({ theme: { value: "dark", updatedAt: 999 } });
  expect(await AsyncStorage.getItem(APP_THEME_STORAGE_KEY)).toBe("dark");
  expect((await getSettingsMeta()).theme).toBe(999);
});

it("applyMerged ignores a remote value that is not newer than local", async () => {
  await AsyncStorage.setItem(APP_THEME_STORAGE_KEY, "light");
  await bumpStamp("theme", 100);
  await settingsAdapter.applyMerged({ theme: { value: "dark", updatedAt: 100 } });
  expect(await AsyncStorage.getItem(APP_THEME_STORAGE_KEY)).toBe("light");
});
