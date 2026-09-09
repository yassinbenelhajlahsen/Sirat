import { renderHook } from "@testing-library/react-native";

import { useTabBarClearance } from "@/hooks/useTabBarClearance";
import { tabBarClearanceForInset } from "@/utils/tabBarChrome";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

describe("useTabBarClearance", () => {
  it("derives the clearance from the bottom safe-area inset", () => {
    const { result } = renderHook(() => useTabBarClearance());
    expect(result.current).toBe(tabBarClearanceForInset(34));
  });
});
