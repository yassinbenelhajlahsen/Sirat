import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  clearMissedFast,
  getMissedFastDays,
  getRamadanPeriodSummary,
  markFastAsMissed,
  missedFastsInPeriod,
  wasFastMissed,
} from "@/services/ramadanTracker";

describe("services/ramadanTracker", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("persists missed fasts using local YYYY-MM-DD keys", async () => {
    const day = new Date(2026, 1, 28, 23, 30, 0);
    await markFastAsMissed(day);

    const raw = await AsyncStorage.getItem("ramadan_tracker_v1");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual({ "2026-02-28": true });
    await expect(wasFastMissed(new Date(2026, 1, 28, 6, 0, 0))).resolves.toBe(true);
  });

  it("clears persisted missed fast marker for a specific day", async () => {
    await markFastAsMissed(new Date(2026, 2, 1));
    await markFastAsMissed(new Date(2026, 2, 2));

    await clearMissedFast(new Date(2026, 2, 1));

    const map = await getMissedFastDays();
    expect(map).toEqual({ "2026-03-02": true });
    await expect(wasFastMissed(new Date(2026, 2, 1))).resolves.toBe(false);
  });

  describe("missed fasts in a Ramadan period", () => {
    const period = { start: new Date(2026, 1, 18), end: new Date(2026, 2, 19) };
    const map = {
      "2026-02-14": true, // 4 days before: too early
      "2026-02-15": true, // 3 days before: counts
      "2026-03-01": true,
      "2026-03-05": false, // cleared
      "2026-03-22": true, // 3 days after: counts
      "2026-03-23": true, // too late
    };

    it("counts the 3 days either side and ignores cleared ones", () => {
      expect(missedFastsInPeriod(map, period)).toEqual(["2026-02-15", "2026-03-01", "2026-03-22"]);
    });

    it("summarises them as short dates", () => {
      expect(getRamadanPeriodSummary(map, period)).toEqual({
        totalMissed: 3,
        missedDays: ["Feb 15", "Mar 1", "Mar 22"],
      });
    });
  });
});
