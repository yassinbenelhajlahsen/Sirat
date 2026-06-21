import AsyncStorage from "@react-native-async-storage/async-storage";
import { SETTINGS_REGISTRY } from "@/services/sync/settingsRegistry";

beforeEach(async () => { await AsyncStorage.clear(); });

it("covers exactly the synced setting keys", () => {
  expect(SETTINGS_REGISTRY.map((e) => e.key).sort()).toEqual(
    ["prayerSettings", "quranBookmarks", "quranDisplayModes", "quranProgress", "ramadanTracker", "theme"],
  );
});

it("theme entry round-trips value via read/applyValue", async () => {
  const theme = SETTINGS_REGISTRY.find((e) => e.key === "theme")!;
  await theme.applyValue("dark");
  expect(await theme.read()).toBe("dark");
});
