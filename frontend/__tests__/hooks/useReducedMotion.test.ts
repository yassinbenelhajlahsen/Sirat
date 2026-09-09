import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import { useReducedMotion } from "@/hooks/useReducedMotion";

describe("useReducedMotion", () => {
  it("reads the OS setting and follows live changes", async () => {
    let listener: ((value: boolean) => void) | undefined;
    const remove = jest.fn();
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    jest
      .spyOn(AccessibilityInfo, "addEventListener")
      .mockImplementation(((event: string, handler: (value: boolean) => void) => {
        if (event === "reduceMotionChanged") listener = handler;
        return { remove };
      }) as never);

    const { result, unmount } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));

    act(() => listener?.(false));
    expect(result.current).toBe(false);

    unmount();
    expect(remove).toHaveBeenCalled();
  });
});
