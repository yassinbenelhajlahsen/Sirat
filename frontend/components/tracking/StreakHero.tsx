import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import DisplayNumber from "@/components/ui/DisplayNumber";
import { Headline } from "@/components/ui/Text";
import type { AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

/** The streak sits bare on the canvas: nothing else on the screen outranks it. */
export default function StreakHero({ streak }: { streak: number }) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.wrap}>
      <DisplayNumber value={streak} size={72} color={colors.white} />
      <View style={styles.labelRow}>
        <Text style={styles.flame} accessibilityLabel="Current streak" maxFontSizeMultiplier={1.2}>
          🔥
        </Text>
        <Headline color={colors.textSecondary}>day streak</Headline>
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { spacing } = theme;
  return StyleSheet.create({
    wrap: { gap: spacing.xs },
    labelRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    flame: { fontSize: 15 },
  });
};
