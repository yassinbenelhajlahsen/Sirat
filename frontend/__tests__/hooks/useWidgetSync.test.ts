import { renderHook } from "@testing-library/react-native";
import { act } from "@testing-library/react-native";
import { AppState } from "react-native";

import { useWidgetSync } from "@/hooks/useWidgetSync";
import { prayerSettingsSetting, themeSetting } from "@/services/syncedSettings";

const mockSyncWidgets = jest.fn(async () => {});
jest.mock("@/services/widgets/sync", () => ({
  syncWidgets: () => mockSyncWidgets(),
}));

describe("useWidgetSync", () => {
  it("syncs once on mount", () => {
    renderHook(() => useWidgetSync());
    expect(mockSyncWidgets).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["prayer settings", () => prayerSettingsSetting.set({ method: 2 })],
    ["the theme", () => themeSetting.set("dark")],
  ])("syncs again when %s change", async (_name, change) => {
    renderHook(() => useWidgetSync());
    mockSyncWidgets.mockClear();
    await act(async () => { await change(); });
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

  it("stops listening when unmounted", async () => {
    const { unmount } = renderHook(() => useWidgetSync());
    unmount();
    mockSyncWidgets.mockClear();
    await prayerSettingsSetting.set({ method: 3 });
    expect(mockSyncWidgets).not.toHaveBeenCalled();
  });
});
