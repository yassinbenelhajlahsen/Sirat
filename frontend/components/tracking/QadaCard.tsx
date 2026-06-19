import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import DisplayNumber from "@/components/ui/DisplayNumber";
import GlassSurface from "@/components/ui/GlassSurface";
import { Caption, Headline } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

export default function QadaCard({ count }: { count: number }) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <GlassSurface tier="card" radius={theme.radii.card} style={styles.card}>
      <Ionicons name="refresh-circle-outline" size={24} color={colors.accent} />
      <View style={styles.textCol}>
        <Headline>Qada</Headline>
        <Caption color={withOpacity(colors.white, 0.6)}>Prayers to make up</Caption>
      </View>
      <DisplayNumber value={count} size={34} color={colors.accent} />
    </GlassSurface>
  );
}

const createStyles = (theme: AppTheme) => {
  const { spacing } = theme;
  return StyleSheet.create({
    card: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
    textCol: { flex: 1, gap: 2 },
  });
};
