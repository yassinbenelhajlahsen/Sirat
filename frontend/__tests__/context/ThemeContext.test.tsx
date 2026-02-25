import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import { APP_THEME_STORAGE_KEY, defaultTheme } from "@/constants/theme";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";

const wrapper = ({ children }: PropsWithChildren) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe("context/ThemeContext", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("hydrates a stored valid theme name and marks provider as hydrated", async () => {
    await AsyncStorage.setItem(APP_THEME_STORAGE_KEY, "dark");

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.themeName).toBe("default");
    expect(result.current.isHydrated).toBe(false);

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
      expect(result.current.themeName).toBe("dark");
      expect(result.current.theme.name).toBe("dark");
    });
  });

  it("falls back to default theme when stored theme is invalid", async () => {
    await AsyncStorage.setItem(APP_THEME_STORAGE_KEY, "sepia");

    const { result } = renderHook(() => useTheme(), { wrapper });

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
      expect(result.current.themeName).toBe("default");
      expect(result.current.theme).toEqual(defaultTheme);
    });
  });

  it("persists theme updates from setTheme", async () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    await act(async () => {
      await result.current.setTheme("light");
    });

    expect(result.current.themeName).toBe("light");
    expect(result.current.theme.name).toBe("light");
    await expect(AsyncStorage.getItem(APP_THEME_STORAGE_KEY)).resolves.toBe("light");
  });

  it("keeps default theme and completes hydration when storage read fails", async () => {
    const readError = new Error("read-failed");
    const getItemMock = AsyncStorage.getItem as jest.MockedFunction<
      typeof AsyncStorage.getItem
    >;
    getItemMock.mockRejectedValueOnce(readError);
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useTheme(), { wrapper });

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
      expect(result.current.themeName).toBe("default");
      expect(result.current.theme).toEqual(defaultTheme);
    });

    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to hydrate app theme preference",
      readError,
    );
    errorSpy.mockRestore();
  });

  it("throws when useTheme is used outside ThemeProvider", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useTheme())).toThrow(
      "useTheme must be used within ThemeProvider",
    );

    errorSpy.mockRestore();
  });
});
