import AsyncStorage from "@react-native-async-storage/async-storage";

import { readRamadanMode, writeRamadanMode } from "@/services/notifications/storage";
import { STORAGE_RAMADAN_MODE } from "@/utils/notifications/constants";

describe("notifications/storage Ramadan helpers", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("defaults to on", async () => {
    await expect(readRamadanMode()).resolves.toBe(true);
  });

  it("round-trips the stored string form", async () => {
    await writeRamadanMode(false);
    expect(await AsyncStorage.getItem(STORAGE_RAMADAN_MODE)).toBe("0");
    await expect(readRamadanMode()).resolves.toBe(false);
  });

  it("ignores malformed values", async () => {
    await writeRamadanMode("yes");
    expect(await AsyncStorage.getItem(STORAGE_RAMADAN_MODE)).toBeNull();
  });
});
