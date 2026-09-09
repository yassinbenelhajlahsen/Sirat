import {
  AURORA_ACCENT_OPACITY,
  AURORA_SECONDARY_OPACITY,
} from "@/components/ui/Aurora";

describe("Aurora", () => {
  it("keeps the blooms toned down", () => {
    expect(AURORA_ACCENT_OPACITY).toBe(0.13);
    expect(AURORA_SECONDARY_OPACITY).toBe(0.12);
  });
});
