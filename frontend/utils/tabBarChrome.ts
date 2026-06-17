import { Animated, NativeScrollEvent, NativeSyntheticEvent } from "react-native";

// Shared chrome state for the floating tab bar. 0 = full size, 1 = collapsed.
// Module-level (not context) because the bar renders outside the scrolling
// screen, so it needs a channel that doesn't require wrapping the navigator.
export const tabBarCollapse = new Animated.Value(0);

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
