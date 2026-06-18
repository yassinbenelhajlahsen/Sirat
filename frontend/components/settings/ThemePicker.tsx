// frontend/components/settings/ThemePicker.tsx
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import PressableScale from "@/components/PressableScale";
import { Caption } from "@/components/ui/Text";
import {
  themeMap,
  withOpacity,
  type AppTheme,
  type ThemeName,
} from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";

const THEMES: { name: ThemeName; label: string }[] = [
  { name: "default", label: "Default" },
  { name: "dark", label: "Dark" },
  { name: "light", label: "Light" },
];

export default function ThemePicker() {
  const { theme, themeName, setTheme } = useTheme();
  const haptics = useHaptics();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row}>
      {THEMES.map((t) => {
        const active = themeName === t.name;
        const palette = themeMap[t.name].colors;
        return (
          <PressableScale
            key={t.name}
            scaleTo={0.97}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${t.label} theme`}
            onPress={() => {
              if (active) return;
              haptics("selection");
              void setTheme(t.name);
            }}
            style={[styles.card, active && styles.cardActive]}
          >
            <LinearGradient
              colors={[palette.primaryDeep, palette.primaryLift]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.swatch}
            >
              <View style={[styles.dot, { backgroundColor: palette.accent }]} />
            </LinearGradient>
            <Caption color={active ? theme.colors.accent : theme.colors.white}>
              {t.label}
            </Caption>
          </PressableScale>
        );
      })}
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    row: { flexDirection: "row", gap: spacing.sm, padding: spacing.md },
    card: {
      flex: 1,
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.sm,
      borderRadius: theme.radii.row,
      borderCurve: "continuous",
      borderWidth: 1.5,
      borderColor: withOpacity(colors.white, 0.1),
      backgroundColor: withOpacity(colors.white, 0.04),
    },
    cardActive: {
      borderColor: colors.accent,
      backgroundColor: withOpacity(colors.accent, 0.1),
    },
    swatch: {
      width: "100%",
      height: 54,
      borderRadius: theme.radii.chip,
      borderCurve: "continuous",
      overflow: "hidden",
      justifyContent: "flex-end",
      alignItems: "flex-end",
      padding: 7,
    },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: withOpacity(colors.white, 0.6),
    },
  });
};
