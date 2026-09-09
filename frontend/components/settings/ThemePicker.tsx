// frontend/components/settings/ThemePicker.tsx
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import PressableScale from "@/components/PressableScale";
import AppIcon from "@/components/ui/AppIcon";
import { Footnote } from "@/components/ui/Text";
import { themeMap, type AppTheme, type ThemeName } from "@/constants/theme";
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
            variant="button"
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${t.label} theme`}
            onPress={() => {
              if (active) return;
              haptics("selection");
              void setTheme(t.name);
            }}
            style={styles.card}
          >
            <LinearGradient
              colors={[palette.primaryDeep, palette.primaryLift]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.swatch, active && styles.swatchActive]}
            />
            <View style={styles.labelRow}>
              <Footnote color={active ? theme.colors.accent : theme.colors.white}>
                {t.label}
              </Footnote>
              {active ? (
                <AppIcon name="checkmark" size={13} color={theme.colors.accent} />
              ) : null}
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    row: { flexDirection: "row", gap: spacing.md, padding: spacing.lg },
    card: { flex: 1, alignItems: "center", gap: spacing.sm },
    // Only the selected swatch is ringed; the label carries the state too.
    swatch: {
      width: "100%",
      height: 56,
      borderRadius: theme.radii.row,
      borderCurve: "continuous",
      overflow: "hidden",
    },
    swatchActive: { borderWidth: 2, borderColor: colors.accent },
    labelRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  });
};
