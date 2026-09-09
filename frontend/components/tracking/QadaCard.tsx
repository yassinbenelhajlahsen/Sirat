import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import DisplayNumber from "@/components/ui/DisplayNumber";
import { Body, Footnote } from "@/components/ui/Text";
import type { AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

export default function QadaCard({ count }: { count: number }) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row}>
      <View style={styles.textCol}>
        <Body>Qada</Body>
        <Footnote color={colors.textTertiary}>Prayers to make up</Footnote>
      </View>
      <DisplayNumber value={count} size={34} color={colors.accent} />
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { spacing } = theme;
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 44 },
    textCol: { flex: 1, gap: 2 },
  });
};
