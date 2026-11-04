import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  readRamadanMode,
  readSuhoorEnabled,
  readSuhoorOffset,
  writeRamadanMode,
  writeSuhoorEnabled,
  writeSuhoorOffset,
} from "@/services/notifications/storage";
import {
  STORAGE_RAMADAN_MODE,
  STORAGE_SUHOOR,
  STORAGE_SUHOOR_OFFSET,
} from "@/utils/notifications/constants";

describe("notifications/storage Ramadan helpers", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("defaults: mode on, suhoor off, offset 30", async () => {
    await expect(readRamadanMode()).resolves.toBe(true);
    await expect(readSuhoorEnabled()).resolves.toBe(false);
    await expect(readSuhoorOffset()).resolves.toBe(30);
  });

  it("round-trips the stored string forms", async () => {
    await writeRamadanMode(false);
    await writeSuhoorEnabled(true);
    await writeSuhoorOffset(45);
    expect(await AsyncStorage.getItem(STORAGE_RAMADAN_MODE)).toBe("0");
    expect(await AsyncStorage.getItem(STORAGE_SUHOOR)).toBe("1");
    expect(await AsyncStorage.getItem(STORAGE_SUHOOR_OFFSET)).toBe("45");
    await expect(readRamadanMode()).resolves.toBe(false);
    await expect(readSuhoorEnabled()).resolves.toBe(true);
    await expect(readSuhoorOffset()).resolves.toBe(45);
  });

  it("ignores malformed values", async () => {
    await writeRamadanMode("yes");
    await writeSuhoorEnabled(1);
    await writeSuhoorOffset(20);
    expect(await AsyncStorage.getItem(STORAGE_RAMADAN_MODE)).toBeNull();
    expect(await AsyncStorage.getItem(STORAGE_SUHOOR)).toBeNull();
    expect(await AsyncStorage.getItem(STORAGE_SUHOOR_OFFSET)).toBeNull();

    await AsyncStorage.setItem(STORAGE_SUHOOR_OFFSET, "20");
    await expect(readSuhoorOffset()).resolves.toBe(30);
  });
});
