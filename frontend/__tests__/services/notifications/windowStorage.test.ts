import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  readWindowMap,
  readWindowOffset,
} from "@/services/notifications/storage";
import {
  DEFAULT_WINDOW_OFFSET,
  DEFAULT_WINDOW_PREFS,
  STORAGE_WINDOW_MAP,
  STORAGE_WINDOW_OFFSET,
} from "@/utils/notifications/constants";

describe("notifications/storage window helpers", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("returns all-false defaults when no window map is stored", async () => {
    await expect(readWindowMap()).resolves.toEqual(DEFAULT_WINDOW_PREFS);
  });

  it("merges stored window prefs over defaults and ignores junk keys", async () => {
    await AsyncStorage.setItem(
      STORAGE_WINDOW_MAP,
      JSON.stringify({ Dhuhr: true, Sunrise: true, Asr: "bad" }),
    );
    await expect(readWindowMap()).resolves.toEqual({
      ...DEFAULT_WINDOW_PREFS,
      Dhuhr: true,
    });
  });

  it("returns the default offset when nothing is stored", async () => {
    await expect(readWindowOffset()).resolves.toBe(DEFAULT_WINDOW_OFFSET);
  });

  it("reads a valid stored offset and rejects out-of-set values", async () => {
    await AsyncStorage.setItem(STORAGE_WINDOW_OFFSET, "20");
    await expect(readWindowOffset()).resolves.toBe(20);

    await AsyncStorage.setItem(STORAGE_WINDOW_OFFSET, "13");
    await expect(readWindowOffset()).resolves.toBe(DEFAULT_WINDOW_OFFSET);
  });
});
