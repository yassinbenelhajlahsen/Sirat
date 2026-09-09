import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

type Module = typeof import("@/services/quranTextScale");

function loadService(): Module {
  jest.resetModules();
  return require("@/services/quranTextScale") as Module;
}

describe("quranTextScale", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("defaults to 1 when nothing is stored", async () => {
    const s = loadService();
    expect(await s.getQuranTextScale()).toBe(1);
    expect(s.getCachedQuranTextScale()).toBe(1);
  });

  it("snaps stored or junk values to the nearest allowed step", () => {
    const s = loadService();
    expect(s.sanitizeQuranTextScale("1.15")).toBe(1.15);
    expect(s.sanitizeQuranTextScale(1.2)).toBe(1.15);
    expect(s.sanitizeQuranTextScale(4)).toBe(1.3);
    expect(s.sanitizeQuranTextScale("nope")).toBe(1);
    expect(s.sanitizeQuranTextScale(undefined)).toBe(1);
  });

  it("persists under the versioned key and emits an update event", async () => {
    const s = loadService();
    const emit = jest.spyOn(DeviceEventEmitter, "emit");
    await s.saveQuranTextScale(1.3);
    expect(await AsyncStorage.getItem(s.QURAN_TEXT_SCALE_STORAGE_KEY)).toBe("1.3");
    expect(emit).toHaveBeenCalledWith(s.QURAN_TEXT_SCALE_UPDATED_EVENT, 1.3);
    expect(s.getCachedQuranTextScale()).toBe(1.3);
  });

  it("reads a previously saved value on cold load", async () => {
    await AsyncStorage.setItem("quran_text_scale_v1", "0.9");
    const s = loadService();
    expect(await s.getQuranTextScale()).toBe(0.9);
  });
});
