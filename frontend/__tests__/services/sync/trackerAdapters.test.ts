import AsyncStorage from "@react-native-async-storage/async-storage";
import { prayerLogAdapter } from "@/services/sync/adapters/prayerLogAdapter";
import { getCachedPrayerLog, setPrayerStatus } from "@/services/tracking/prayerLog";

beforeEach(async () => { await AsyncStorage.clear(); });

it("prayerLogAdapter.applyMerged keeps the newer cell per LWW", async () => {
  // local has a newer fajr edit; server has an older fajr + a maghrib.
  await prayerLogAdapter.applyMerged({}); // seed empty
  await setPrayerStatus("2026-06-20", "fajr", "prayed");
  const localFajr = getCachedPrayerLog()["2026-06-20"].fajr!;
  await prayerLogAdapter.applyMerged({
    "2026-06-20": {
      fajr: { value: "missed", updatedAt: localFajr.updatedAt - 1 }, // older -> loses
      maghrib: { value: "prayed", updatedAt: 999 },
    },
  });
  const merged = getCachedPrayerLog()["2026-06-20"];
  expect(merged.fajr!.value).toBe("prayed"); // local newer wins
  expect(merged.maghrib!.value).toBe("prayed"); // server-only key applied
});
