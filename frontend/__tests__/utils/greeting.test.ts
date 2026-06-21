import { getGreeting, personalizeGreeting } from "@/utils/greeting";

const at = (hour: number) => new Date(2026, 5, 16, hour, 0, 0);

describe("getGreeting", () => {
  it("returns morning from 5:00 to 11:59", () => {
    expect(getGreeting(at(5))).toBe("Good morning");
    expect(getGreeting(at(11))).toBe("Good morning");
  });
  it("returns evening from midnight to 4:59", () => {
    expect(getGreeting(at(0))).toBe("Good evening");
    expect(getGreeting(at(4))).toBe("Good evening");
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

describe("personalizeGreeting", () => {
  it("appends name with comma and period when name is under 10 chars", () => {
    expect(personalizeGreeting("Good morning", "Ali")).toBe("Good morning, Ali.");
    expect(personalizeGreeting("Good evening", "Yassin")).toBe("Good evening, Yassin.");
  });
  it("returns greeting unchanged when name is 10 or more characters", () => {
    expect(personalizeGreeting("Good morning", "Abdurrahman")).toBe("Good morning");
    expect(personalizeGreeting("Good morning", "1234567890")).toBe("Good morning");
  });
  it("returns greeting unchanged when firstName is null", () => {
    expect(personalizeGreeting("Good morning", null)).toBe("Good morning");
  });
});
