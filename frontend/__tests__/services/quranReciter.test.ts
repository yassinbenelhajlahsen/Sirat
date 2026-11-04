import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

type Mod = typeof import("@/services/quranReciter");
function loadService(): Mod {
  jest.resetModules();
  return require("@/services/quranReciter") as Mod;
}

describe("quranReciter", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("defaults to Alafasy when nothing or an unknown id is stored", async () => {
    expect(await loadService().getQuranReciter()).toBe("alafasy");

    await AsyncStorage.setItem("quran_reciter_v1", "bogus");
    expect(await loadService().getQuranReciter()).toBe("alafasy");
  });

  it("saves, persists, caches and emits the update event", async () => {
    const service = loadService();
    const emitSpy = jest.spyOn(DeviceEventEmitter, "emit");

    expect(await service.saveQuranReciter("minshawi")).toBe("minshawi");
    expect(await AsyncStorage.getItem("quran_reciter_v1")).toBe("minshawi");
    expect(service.getCachedQuranReciter()).toBe("minshawi");
    expect(emitSpy).toHaveBeenCalledWith(service.QURAN_RECITER_UPDATED_EVENT, "minshawi");

    expect(await loadService().getQuranReciter()).toBe("minshawi");
  });
});
