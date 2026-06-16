import {
  SPRING_GENTLE, SPRING_PRESS, PRESS_SCALE,
  TIMING_ENTER, TIMING_EXIT, BREATH_HALF_CYCLE, STAGGER_MS,
} from "@/constants/motion";

describe("motion constants", () => {
  it("uses a gentle, low-bounce press scale", () => {
    expect(PRESS_SCALE).toBe(0.97);
    expect(SPRING_PRESS).toEqual({ speed: 18, bounciness: 4 });
    expect(SPRING_GENTLE).toEqual({ speed: 14, bounciness: 3 });
  });
  it("uses calm timings", () => {
    expect(TIMING_ENTER).toBe(480);
    expect(TIMING_EXIT).toBe(320);
    expect(BREATH_HALF_CYCLE).toBe(2300);
    expect(STAGGER_MS).toBe(70);
  });
});
