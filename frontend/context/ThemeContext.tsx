import {
  type PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance } from "react-native";

import { themeSetting } from "@/services/syncedSettings";

import {
  AppTheme,
  ThemeName,
  defaultTheme,
  themeMap,
} from "@/constants/theme";

type ThemeContextValue = {
  themeName: ThemeName;
  theme: AppTheme;
  setTheme: (themeName: ThemeName) => Promise<void>;
  isHydrated: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [themeName, setThemeName] = useState<ThemeName>(() => themeSetting.peek());
  const [isHydrated, setIsHydrated] = useState(false);

  // Follows local picks and themes synced in from another device.
  useEffect(() => {
    let isMounted = true;
    const unsubscribe = themeSetting.subscribe((next) => {
      if (isMounted) setThemeName(next);
    });

    (async () => {
      try {
        const stored = await themeSetting.get();
        if (isMounted) setThemeName(stored);
      } catch (error) {
        console.error("Failed to hydrate app theme preference", error);
      } finally {
        if (isMounted) {
          setIsHydrated(true);
        }
      }
    })();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Native UI (Alert, Switch, ActionSheet, Modal backdrop, share sheet) follows
  // the picked theme through the OS color scheme.
  useEffect(() => {
    Appearance.setColorScheme(themeName === "light" ? "light" : "dark");
  }, [themeName]);

  const setTheme = useCallback(async (nextTheme: ThemeName) => {
    setThemeName(nextTheme);
    try {
      await themeSetting.set(nextTheme);
    } catch (error) {
      console.error("Failed to persist app theme preference", error);
    }
  }, []);

  const theme = useMemo(() => themeMap[themeName] ?? defaultTheme, [themeName]);

  const value = useMemo(
    () => ({
      themeName,
      theme,
      setTheme,
      isHydrated,
    }),
    [themeName, theme, setTheme, isHydrated],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
