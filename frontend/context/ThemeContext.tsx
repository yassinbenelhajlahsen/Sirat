import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  type PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  APP_THEME_STORAGE_KEY,
  AppTheme,
  ThemeName,
  defaultTheme,
  isThemeName,
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
  const [themeName, setThemeName] = useState<ThemeName>("default");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const storedTheme = await AsyncStorage.getItem(APP_THEME_STORAGE_KEY);
        if (isMounted && isThemeName(storedTheme)) {
          setThemeName(storedTheme);
        }
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
    };
  }, []);

  const setTheme = useCallback(async (nextTheme: ThemeName) => {
    setThemeName(nextTheme);
    try {
      await AsyncStorage.setItem(APP_THEME_STORAGE_KEY, nextTheme);
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
