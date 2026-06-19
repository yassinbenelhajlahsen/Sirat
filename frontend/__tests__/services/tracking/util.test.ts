import { newId, nowMs } from "@/services/tracking/util";

describe("tracking/util", () => {
  it("newId returns a unique non-empty string each call", () => {
    const a = newId();
    const b = newId();
    expect(typeof a).toBe("string");
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });

  it("nowMs returns the current epoch ms", () => {
    const spy = jest.spyOn(Date, "now").mockReturnValue(1700000000000);
    expect(nowMs()).toBe(1700000000000);
    spy.mockRestore();
  });
});
