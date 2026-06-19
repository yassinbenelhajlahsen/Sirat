import AsyncStorage from "@react-native-async-storage/async-storage";

const HABITS_KEY = "tracking:habits_v1";

describe("legacy weekly habit migration", () => {
  beforeEach(async () => {
    jest.resetModules();
    await AsyncStorage.clear();
  });

  it("coerces a legacy {weekly, timesPerWeek} habit to daily on read", async () => {
    const legacy = [
      {
        id: "h1",
        name: "Tahajjud",
        icon: "moon-outline",
        frequency: { type: "weekly", timesPerWeek: 3 },
        order: 0,
        archived: false,
        createdAtKey: "2026-06-01",
        updatedAt: 1,
      },
    ];
    await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(legacy));
    const { getActiveHabits } = require("@/services/tracking/habits");
    const habits = await getActiveHabits();
    expect(habits[0].frequency).toEqual({ type: "daily" });
  });

  it("leaves a valid {weekly, days} habit untouched", async () => {
    const valid = [
      {
        id: "h2",
        name: "Fast",
        icon: "restaurant-outline",
        frequency: { type: "weekly", days: [1, 4] },
        order: 0,
        archived: false,
        createdAtKey: "2026-06-01",
        updatedAt: 1,
      },
    ];
    await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(valid));
    const { getActiveHabits } = require("@/services/tracking/habits");
    const habits = await getActiveHabits();
    expect(habits[0].frequency).toEqual({ type: "weekly", days: [1, 4] });
  });
});
