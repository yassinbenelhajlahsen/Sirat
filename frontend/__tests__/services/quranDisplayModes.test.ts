import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

type QuranDisplayModesModule = typeof import("@/services/quranDisplayModes");

function loadService(): QuranDisplayModesModule {
  jest.resetModules();
  return require("@/services/quranDisplayModes") as QuranDisplayModesModule;
}

describe("quranDisplayModes", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("sanitizes loaded modes with dedupe + invalid filtering", async () => {
    const service = loadService();

    await AsyncStorage.setItem(
      "quran_display_modes",
      JSON.stringify(["english", "english", "bad", 3, "arabic", "transliteration"])
    );

    const modes = await service.getQuranDisplayModes();
    expect(modes).toEqual(["english", "arabic", "transliteration"]);
  });

  it("falls back to default mode when storage is empty or invalid", async () => {
    const service = loadService();

    expect(await service.getQuranDisplayModes()).toEqual(["arabic"]);

    await AsyncStorage.clear();
    await AsyncStorage.setItem("quran_display_modes", "not-json");
    const reloaded = loadService();
    expect(await reloaded.getQuranDisplayModes()).toEqual(["arabic"]);
  });

  it("sanitizes on save, updates cache, and emits update event", async () => {
    const service = loadService();
    const emitSpy = jest.spyOn(DeviceEventEmitter, "emit");

    const next = await service.saveQuranDisplayModes([
      "english",
      "english",
      "transliteration",
      "bad" as never,
    ]);

    expect(next).toEqual(["english", "transliteration"]);
    expect(service.getCachedQuranDisplayModes()).toEqual(["english", "transliteration"]);
    expect(emitSpy).toHaveBeenCalledWith(service.QURAN_DISPLAY_MODES_UPDATED_EVENT, [
      "english",
      "transliteration",
    ]);
  });

  it("toggles modes and prevents removing the final enabled mode", async () => {
    const service = loadService();

    await service.saveQuranDisplayModes(["arabic", "english"]);

    expect(await service.toggleQuranDisplayMode("english")).toEqual(["arabic"]);
    expect(await service.toggleQuranDisplayMode("arabic")).toEqual(["arabic"]);
    expect(await service.toggleQuranDisplayMode("transliteration")).toEqual([
      "arabic",
      "transliteration",
    ]);
  });

  it("preload initializes cache-backed reads", async () => {
    await AsyncStorage.setItem("quran_display_modes", JSON.stringify(["english"]));
    const service = loadService();

    await service.preloadQuranDisplayModes();
    expect(service.getCachedQuranDisplayModes()).toEqual(["english"]);
  });
});
