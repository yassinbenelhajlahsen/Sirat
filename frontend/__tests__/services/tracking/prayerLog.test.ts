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

    await svc.setPrayerStatus("2026-06-19", "Fajr", "prayed");

    expect(await svc.getDayStatuses("2026-06-19")).toEqual({ Fajr: "prayed" });
    const raw = JSON.parse(
      (await AsyncStorage.getItem("tracking:prayer_log_v1")) as string,
    );
    expect(raw["2026-06-19"].fajr).toEqual({ value: "prayed", updatedAt: 1700000000000 });
    expect(emit).toHaveBeenCalledWith("PRAYER_LOG_UPDATED", { dateKey: "2026-06-19" });
  });

  it("clearing writes a time-stamped cleared mark that reads as not logged", async () => {
    const svc = loadService();
    await svc.setPrayerStatus("2026-06-19", "Asr", "late");
    (Date.now as jest.Mock).mockReturnValue(1700000005000);
    const emit = jest.spyOn(DeviceEventEmitter, "emit");

    await svc.clearPrayerStatus("2026-06-19", "Asr");

    expect(await svc.getDayStatuses("2026-06-19")).toEqual({});
    const raw = JSON.parse((await AsyncStorage.getItem("tracking:prayer_log_v1")) as string);
    expect(raw["2026-06-19"].asr).toEqual({ value: null, updatedAt: 1700000005000 });
    expect(emit).toHaveBeenCalledWith("PRAYER_LOG_UPDATED", { dateKey: "2026-06-19" });
  });

  it("clearing an unlogged or already cleared prayer changes nothing", async () => {
    const svc = loadService();
    await svc.clearPrayerStatus("2026-06-19", "Fajr");
    expect(await AsyncStorage.getItem("tracking:prayer_log_v1")).toBeNull();

    await svc.setPrayerStatus("2026-06-19", "Fajr", "prayed");
    await svc.clearPrayerStatus("2026-06-19", "Fajr");
    const emit = jest.spyOn(DeviceEventEmitter, "emit");
    await svc.clearPrayerStatus("2026-06-19", "Fajr");
    expect(emit).not.toHaveBeenCalled();
  });

  it("logging again after a clear replaces the cleared mark", async () => {
    const svc = loadService();
    await svc.setPrayerStatus("2026-06-19", "Isha", "late");
    await svc.clearPrayerStatus("2026-06-19", "Isha");
    await svc.setPrayerStatus("2026-06-19", "Isha", "prayed");
    expect(await svc.getDayStatuses("2026-06-19")).toEqual({ Isha: "prayed" });
  });

  it("a cleared mark merged in from another device removes the mark here", async () => {
    const svc = loadService();
    await svc.setPrayerStatus("2026-06-19", "Dhuhr", "prayed");
    const { mergePrayerLogs } = require("@/services/tracking/merge");
    await svc.replacePrayerLog(
      mergePrayerLogs(await svc.getPrayerLog(), { "2026-06-19": { dhuhr: { value: null, updatedAt: 1800000000000 } } }),
    );
    expect(await svc.getDayStatuses("2026-06-19")).toEqual({});
  });

  it("ignores malformed stored JSON and starts empty", async () => {
    await AsyncStorage.setItem("tracking:prayer_log_v1", "not-json");
    const svc = loadService();
    expect(await svc.getDayStatuses("2026-06-19")).toEqual({});
  });
});
