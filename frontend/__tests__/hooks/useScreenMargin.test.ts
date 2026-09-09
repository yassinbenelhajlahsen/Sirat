import { useWindowDimensions } from "react-native";
import { renderHook } from "@testing-library/react-native";

import {
  SCREEN_MARGIN_NARROW,
  SCREEN_MARGIN_REGULAR,
  useScreenMargin,
} from "@/hooks/useScreenMargin";

jest.mock("react-native/Libraries/Utilities/useWindowDimensions");

const mockDimensions = useWindowDimensions as unknown as jest.Mock;

describe("useScreenMargin", () => {
  it("tightens the margin on narrow devices", () => {
    mockDimensions.mockReturnValue({ width: 375, height: 812, scale: 3, fontScale: 1 });
    expect(renderHook(() => useScreenMargin()).result.current).toBe(SCREEN_MARGIN_NARROW);
  });

  it("uses the regular margin at full width", () => {
    mockDimensions.mockReturnValue({ width: 430, height: 932, scale: 3, fontScale: 1 });
    expect(renderHook(() => useScreenMargin()).result.current).toBe(SCREEN_MARGIN_REGULAR);
  });
});
