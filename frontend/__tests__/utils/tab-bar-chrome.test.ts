import {
  TAB_BAR_BOTTOM_GAP,
  TAB_BAR_CONTENT_GAP,
  TAB_BAR_HEIGHT,
  TAB_BAR_MIN_BOTTOM_INSET,
  decideCollapse,
  handleTabBarScroll,
  setTabBarReduceMotion,
  tabBarBottomOffset,
  tabBarClearanceForInset,
  tabBarCollapse,
} from "@/utils/tabBarChrome";

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

describe("tab bar geometry", () => {
  it("floats the pill above the home indicator, never closer than the minimum", () => {
    expect(tabBarBottomOffset(0)).toBe(TAB_BAR_MIN_BOTTOM_INSET + TAB_BAR_BOTTOM_GAP);
    expect(tabBarBottomOffset(34)).toBe(34 + TAB_BAR_BOTTOM_GAP);
  });

  it("clearance covers offset + pill height + breathing room", () => {
    expect(tabBarClearanceForInset(34)).toBe(
      34 + TAB_BAR_BOTTOM_GAP + TAB_BAR_HEIGHT + TAB_BAR_CONTENT_GAP,
    );
    // The value every sheet used to hard-code.
    expect(tabBarClearanceForInset(0)).toBe(Math.max(0, 14) + 6 + 64 + 8);
  });
});

describe("reduce motion gate", () => {
  const scrollTo = (y: number) =>
    handleTabBarScroll({ nativeEvent: { contentOffset: { y } } } as never);

  afterEach(() => {
    setTabBarReduceMotion(false);
    scrollTo(0);
  });

  it("ignores scroll-driven collapse while Reduce Motion is on", () => {
    setTabBarReduceMotion(true);
    scrollTo(0);
    scrollTo(400);
    expect((tabBarCollapse as unknown as { _value: number })._value).toBe(0);
  });
});
