import * as prayerTracker from "@/services/prayerTracker";
import * as habitTracker from "@/services/habitTracker";

describe("tracking facades", () => {
  it("prayerTracker re-exports the prayer surface", () => {
    expect(typeof prayerTracker.setPrayerStatus).toBe("function");
    expect(typeof prayerTracker.getDayStatuses).toBe("function");
    expect(typeof prayerTracker.prayerStreak).toBe("function");
    expect(typeof prayerTracker.qadaCount).toBe("function");
    expect(typeof prayerTracker.preloadPrayerLog).toBe("function");
  });

  it("habitTracker re-exports the habit surface", () => {
    expect(typeof habitTracker.createHabit).toBe("function");
    expect(typeof habitTracker.getActiveHabits).toBe("function");
    expect(typeof habitTracker.setHabitDone).toBe("function");
    expect(typeof habitTracker.habitStreak).toBe("function");
    expect(typeof habitTracker.preloadHabitLog).toBe("function");
  });
});
