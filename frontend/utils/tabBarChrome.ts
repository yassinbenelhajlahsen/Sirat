import { Animated, NativeScrollEvent, NativeSyntheticEvent } from "react-native";

// Geometry of the floating glass pill. GlassTabBar draws from these and every
// sheet/scroll view pads its bottom from the same numbers via
// `useTabBarClearance`, so the two can't drift apart.
export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_MIN_BOTTOM_INSET = 14;
export const TAB_BAR_BOTTOM_GAP = 6;
export const TAB_BAR_CONTENT_GAP = 8;

export function tabBarBottomOffset(bottomInset: number): number {
  return Math.max(bottomInset, TAB_BAR_MIN_BOTTOM_INSET) + TAB_BAR_BOTTOM_GAP;
}

export function tabBarClearanceForInset(bottomInset: number): number {
  return tabBarBottomOffset(bottomInset) + TAB_BAR_HEIGHT + TAB_BAR_CONTENT_GAP;
}

// Shared chrome state for the floating tab bar. 0 = full size, 1 = collapsed.
// Module-level (not context) because the bar renders outside the scrolling
// screen, so it needs a channel that doesn't require wrapping the navigator.
export const tabBarCollapse = new Animated.Value(0);

// When Reduce Motion is on the bar stays put; screens still call the scroll
// handler, so the gate lives here instead of at every call site.
let reduceMotion = false;
export function setTabBarReduceMotion(value: boolean) {
  reduceMotion = value;
  if (value && collapsed) {
    collapsed = false;
    tabBarCollapse.setValue(0);
  }
}

const TOP_THRESHOLD = 24; // within this many px of the top, the bar is always full
const DIR_THRESHOLD = 6; // ignore movement smaller than this (jitter)

let lastOffset = 0;
let collapsed = false;

// Pure decision used by the scroll handler (and unit-tested directly):
// scrolling down collapses, scrolling up expands, near the top stays full.
export function decideCollapse(
  prevCollapsed: boolean,
  lastY: number,
  y: number,
): boolean {
  if (y < TOP_THRESHOLD) return false;
  const dy = y - lastY;
  if (dy > DIR_THRESHOLD) return true;
  if (dy < -DIR_THRESHOLD) return false;
  return prevCollapsed;
}

function animateTo(value: number) {
  Animated.spring(tabBarCollapse, {
    toValue: value,
    useNativeDriver: true,
    speed: 14,
    bounciness: 6,
  }).start();
}

// Attach to a screen's scrollable (`onScroll={handleTabBarScroll}` +
// `scrollEventThrottle={16}`).
export function handleTabBarScroll(
  e: NativeSyntheticEvent<NativeScrollEvent>,
) {
  if (reduceMotion) return;
  const y = e?.nativeEvent?.contentOffset?.y ?? 0;
  const next = decideCollapse(collapsed, lastOffset, y);
  lastOffset = y;
  if (next !== collapsed) {
    collapsed = next;
    animateTo(next ? 1 : 0);
  }
}

// Force the bar back to full size (e.g. on tab change, so each tab starts open).
export function expandTabBar() {
  lastOffset = 0;
  collapsed = false;
  animateTo(0);
}
