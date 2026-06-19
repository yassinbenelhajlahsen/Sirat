import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

type Mod = typeof import("@/services/tracking/prayerLog");

function loadService(): Mod {
  jest.resetModules();
  return require("@/services/tracking/prayerLog") as Mod;
}

describe("tracking/prayerLog", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    jest.spyOn(Date, "now").mockReturnValue(1700000000000);
  });

  it("returns empty statuses for an unlogged day", async () => {
    const svc = loadService();
    expect(await svc.getDayStatuses("2026-06-19")).toEqual({});
  });

  it("sets a status, persists a cell, unwraps on read, and emits", async () => {
    const svc = loadService();
    const emit = jest.spyOn(DeviceEventEmitter, "emit");

    await svc.setPrayerStatus("2026-06-19", "fajr", "prayed");

    expect(await svc.getDayStatuses("2026-06-19")).toEqual({ fajr: "prayed" });
    const raw = JSON.parse(
      (await AsyncStorage.getItem("tracking:prayer_log_v1")) as string,
    );
    expect(raw["2026-06-19"].fajr).toEqual({ value: "prayed", updatedAt: 1700000000000 });
    expect(emit).toHaveBeenCalledWith("PRAYER_LOG_UPDATED", { dateKey: "2026-06-19" });
  });

  it("clears a status", async () => {
    const svc = loadService();
    await svc.setPrayerStatus("2026-06-19", "asr", "late");
    await svc.clearPrayerStatus("2026-06-19", "asr");
    expect(await svc.getDayStatuses("2026-06-19")).toEqual({});
  });

  it("ignores malformed stored JSON and starts empty", async () => {
    await AsyncStorage.setItem("tracking:prayer_log_v1", "not-json");
    const svc = loadService();
    expect(await svc.getDayStatuses("2026-06-19")).toEqual({});
  });
});
