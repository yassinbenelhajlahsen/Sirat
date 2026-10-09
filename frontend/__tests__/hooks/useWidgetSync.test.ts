import { renderHook } from "@testing-library/react-native";
import { AppState, DeviceEventEmitter } from "react-native";

import { THEME_CHANGED_EVENT } from "@/constants/theme";
import { useWidgetSync } from "@/hooks/useWidgetSync";

const mockSyncWidgets = jest.fn(async () => {});
jest.mock("@/services/widgets/sync", () => ({
  syncWidgets: () => mockSyncWidgets(),
}));

describe("useWidgetSync", () => {
  it("syncs once on mount", () => {
    renderHook(() => useWidgetSync());
    expect(mockSyncWidgets).toHaveBeenCalledTimes(1);
  });

  it.each(["settingsChanged", THEME_CHANGED_EVENT])("syncs again on %s", (event) => {
    renderHook(() => useWidgetSync());
    mockSyncWidgets.mockClear();
    DeviceEventEmitter.emit(event);
    expect(mockSyncWidgets).toHaveBeenCalledTimes(1);
  });

  it("syncs when the app returns to the foreground, not when it leaves", () => {
    let handler: (s: string) => void = () => {};
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, h) => {
      handler = h as (s: string) => void;
      return { remove: jest.fn() } as never;
    });
    renderHook(() => useWidgetSync());
    mockSyncWidgets.mockClear();

    handler("background");
    expect(mockSyncWidgets).not.toHaveBeenCalled();
    handler("active");
    expect(mockSyncWidgets).toHaveBeenCalledTimes(1);
  });

  it("stops listening when unmounted", () => {
    const { unmount } = renderHook(() => useWidgetSync());
    unmount();
    mockSyncWidgets.mockClear();
    DeviceEventEmitter.emit("settingsChanged");
    expect(mockSyncWidgets).not.toHaveBeenCalled();
  });
});
