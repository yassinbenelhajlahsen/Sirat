import { matchByRegex, normalizeInput } from "@/services/duaMatcher";

describe("services/duaMatcher", () => {
  it("normalizes punctuation, case, and spacing", () => {
    expect(normalizeInput("  HeLLo!!!   World??  ")).toBe("hello world");
  });

  it("prioritizes specific exam rule before broader knowledge rule", () => {
    // "study" can match knowledge, but "exam" should win because exam is earlier.
    expect(matchByRegex("I need help studying for my exam tomorrow")).toBe("exam");
  });

  it("prioritizes entering_home over broad family terms", () => {
    expect(matchByRegex("I am coming home to my family")).toBe("entering_home");
  });

  it("returns null when no pattern matches", () => {
    expect(matchByRegex("qwertyuiop asdfghjkl zxcvbnm")).toBeNull();
  });
});
