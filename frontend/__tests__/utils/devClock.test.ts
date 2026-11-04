import { appNow, isPretendingTime, setPretendTime } from "@/utils/devClock";

describe("devClock", () => {
  afterEach(() => setPretendTime(null));

  it("is the real time until a time is pretended", () => {
    expect(Math.abs(appNow().getTime() - Date.now())).toBeLessThan(50);
    expect(isPretendingTime()).toBe(false);
  });

  it("moves today's clock to the chosen time of day and keeps it running", () => {
    setPretendTime({ hour: 17, minute: 30 });
    const now = appNow();
    expect(now.getHours()).toBe(17);
    expect(now.getMinutes()).toBe(30);
    expect(now.toDateString()).toBe(new Date().toDateString());
    expect(isPretendingTime()).toBe(true);
  });

  it("goes back to real time when cleared", () => {
    setPretendTime({ hour: 3, minute: 0 });
    setPretendTime(null);
    expect(isPretendingTime()).toBe(false);
    expect(Math.abs(appNow().getTime() - Date.now())).toBeLessThan(50);
  });
});
