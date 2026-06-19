import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

type Mod = typeof import("@/services/tracking/habitLog");

function loadService(): Mod {
  jest.resetModules();
  return require("@/services/tracking/habitLog") as Mod;
}

describe("tracking/habitLog", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    jest.spyOn(Date, "now").mockReturnValue(1700000000000);
  });

  it("returns empty for an unlogged day", async () => {
    const svc = loadService();
    expect(await svc.getDayHabitDone("2026-06-19")).toEqual({});
  });

  it("sets done, stores a cell, unwraps, and emits", async () => {
    const svc = loadService();
    const emit = jest.spyOn(DeviceEventEmitter, "emit");

    await svc.setHabitDone("2026-06-19", "h1", true);

    expect(await svc.getDayHabitDone("2026-06-19")).toEqual({ h1: true });
    const raw = JSON.parse(
      (await AsyncStorage.getItem("tracking:habit_log_v1")) as string,
    );
    expect(raw["2026-06-19"].h1).toEqual({ value: true, updatedAt: 1700000000000 });
    expect(emit).toHaveBeenCalledWith("HABIT_LOG_UPDATED", { dateKey: "2026-06-19" });
  });

  it("setting done=false keeps an explicit cell (so it syncs as a deliberate undo)", async () => {
    const svc = loadService();
    await svc.setHabitDone("2026-06-19", "h1", true);
    await svc.setHabitDone("2026-06-19", "h1", false);
    expect(await svc.getDayHabitDone("2026-06-19")).toEqual({ h1: false });
  });
});
