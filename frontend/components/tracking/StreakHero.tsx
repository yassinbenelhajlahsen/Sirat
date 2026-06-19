import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import DisplayNumber from "@/components/ui/DisplayNumber";
import GlassSurface from "@/components/ui/GlassSurface";
import { Caption } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

export default function StreakHero({ streak }: { streak: number }) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <GlassSurface tier="card" radius={theme.radii.heroLg} style={styles.card}>
      <Text style={styles.flame} accessibilityLabel="Current streak">🔥</Text>
      <View style={styles.textCol}>
        <DisplayNumber value={streak} size={64} color={colors.white} />
        <Caption color={withOpacity(colors.white, 0.6)} style={styles.label}>
          DAY STREAK
        </Caption>
      </View>
    </GlassSurface>
  );
}

const createStyles = (theme: AppTheme) => {
  const { spacing } = theme;
  return StyleSheet.create({
    card: { flexDirection: "row", alignItems: "center", gap: spacing.lg, padding: spacing.xl },
    flame: { fontSize: 40 },
    textCol: { gap: 2 },
    label: { letterSpacing: 1.4, textTransform: "uppercase" },
  });
};
