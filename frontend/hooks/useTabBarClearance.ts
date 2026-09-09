import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tabBarClearanceForInset } from "@/utils/tabBarChrome";

/**
 * Distance from the screen bottom to just above the floating glass tab bar.
 * Use it as bottom padding for sheets and scroll content so the last row is
 * never trapped behind the pill.
 */
export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  return tabBarClearanceForInset(insets.bottom);
}
