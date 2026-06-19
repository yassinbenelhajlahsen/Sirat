import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

type Mod = typeof import("@/services/tracking/habits");

function loadService(): Mod {
  jest.resetModules();
  return require("@/services/tracking/habits") as Mod;
}

describe("tracking/habits", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    jest.spyOn(Date, "now").mockReturnValue(1700000000000);
  });

  it("creates a habit with an id, stamps, and emits", async () => {
    const svc = loadService();
    const emit = jest.spyOn(DeviceEventEmitter, "emit");

    const h = await svc.createHabit({
      name: "Read Quran",
      icon: "book-outline",
      frequency: { type: "daily" },
    });

    expect(h.id).toBeTruthy();
    expect(h.archived).toBe(false);
    expect(h.order).toBe(0);
    expect(h.updatedAt).toBe(1700000000000);
    expect(emit).toHaveBeenCalledWith("HABITS_UPDATED");
    expect(await svc.getActiveHabits()).toHaveLength(1);
  });

  it("getActiveHabits excludes archived and tombstoned, sorted by order", async () => {
    const svc = loadService();
    const a = await svc.createHabit({ name: "A", icon: "i", frequency: { type: "daily" } });
    const b = await svc.createHabit({ name: "B", icon: "i", frequency: { type: "daily" } });
    await svc.createHabit({ name: "C", icon: "i", frequency: { type: "daily" } });

    await svc.updateHabit(a.id, { archived: true });
    await svc.deleteHabit(b.id);

    const active = await svc.getActiveHabits();
    expect(active.map((h) => h.name)).toEqual(["C"]);
    expect((await svc.getAllHabits()).find((h) => h.id === b.id)?.deletedAt).toBe(1700000000000);
  });

  it("reorderHabits rewrites order by id position", async () => {
    const svc = loadService();
    const a = await svc.createHabit({ name: "A", icon: "i", frequency: { type: "daily" } });
    const b = await svc.createHabit({ name: "B", icon: "i", frequency: { type: "daily" } });

    await svc.reorderHabits([b.id, a.id]);
    const active = await svc.getActiveHabits();
    expect(active.map((h) => h.name)).toEqual(["B", "A"]);
  });

  it("updateHabit patches fields and bumps updatedAt", async () => {
    const svc = loadService();
    const h = await svc.createHabit({ name: "A", icon: "i", frequency: { type: "daily" } });
    jest.spyOn(Date, "now").mockReturnValue(1700000050000);

    await svc.updateHabit(h.id, { name: "A2", frequency: { type: "weekly", days: [1, 4] } });
    const updated = (await svc.getActiveHabits())[0];
    expect(updated.name).toBe("A2");
    expect(updated.frequency).toEqual({ type: "weekly", days: [1, 4] });
    expect(updated.updatedAt).toBe(1700000050000);
  });
});
