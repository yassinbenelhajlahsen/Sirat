import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

import {
  clearMissedFast,
  getMissedFastDays,
  markFastAsMissed,
  replaceMissedFastDays,
  wasFastMissed,
  RAMADAN_TRACKER_UPDATED_EVENT,
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

  it("replaceMissedFastDays overwrites and emits", async () => {
    const emit = jest.spyOn(DeviceEventEmitter, "emit");
    const map = { "2026-03-15": true };
    await replaceMissedFastDays(map);
    expect(await getMissedFastDays()).toEqual(map);
    expect(emit).toHaveBeenCalledWith(RAMADAN_TRACKER_UPDATED_EVENT);
  });
});
