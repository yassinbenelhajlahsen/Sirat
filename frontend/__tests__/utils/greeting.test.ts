import { getGreeting } from "@/utils/greeting";

const at = (hour: number) => new Date(2026, 5, 16, hour, 0, 0);

describe("getGreeting", () => {
  it("returns morning before noon", () => {
    expect(getGreeting(at(0))).toBe("Good morning");
    expect(getGreeting(at(11))).toBe("Good morning");
  });
  it("returns afternoon from noon to 17:59", () => {
    expect(getGreeting(at(12))).toBe("Good afternoon");
    expect(getGreeting(at(17))).toBe("Good afternoon");
  });
  it("returns evening from 18:00 onward", () => {
    expect(getGreeting(at(18))).toBe("Good evening");
    expect(getGreeting(at(23))).toBe("Good evening");
  });
});
