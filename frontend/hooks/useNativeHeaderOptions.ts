import { useMemo } from "react";
import type { NativeStackNavigationOptions } from "expo-router";

import { useTheme } from "@/context/ThemeContext";

/**
 * Native iOS header over the app gradient: transparent so the gradient shows
 * through. Large titles collapse into the bar on scroll; `large: false` gives
 * the small centered title used by modal screens.
 */
export function useNativeHeaderOptions(
  title: string,
  { large = true, titleSize }: { large?: boolean; titleSize?: number } = {},
): NativeStackNavigationOptions {
  const { theme } = useTheme();
  const { white } = theme.colors;
  return useMemo(
    () => ({
      title,
      headerShown: true,
      headerTransparent: true,
      headerLargeTitleEnabled: large,
      headerShadowVisible: false,
      headerLargeTitleShadowVisible: false,
      headerTintColor: white,
      headerTitleStyle: { color: white, fontSize: titleSize },
      headerLargeTitleStyle: { color: white },
      headerBackButtonDisplayMode: "minimal",
    }),
    [title, large, titleSize, white],
  );
}
