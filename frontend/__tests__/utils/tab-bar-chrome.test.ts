import { decideCollapse } from "@/utils/tabBarChrome";

describe("decideCollapse", () => {
  it("collapses when scrolling down past the threshold", () => {
    expect(decideCollapse(false, 100, 140)).toBe(true);
  });

  it("expands when scrolling up past the threshold", () => {
    expect(decideCollapse(true, 200, 160)).toBe(false);
  });

  it("stays full near the top regardless of direction", () => {
    expect(decideCollapse(true, 60, 10)).toBe(false);
    expect(decideCollapse(false, 0, 5)).toBe(false);
  });

  it("keeps the previous state on small jitter", () => {
    expect(decideCollapse(true, 300, 303)).toBe(true);
    expect(decideCollapse(false, 300, 297)).toBe(false);
  });
});
