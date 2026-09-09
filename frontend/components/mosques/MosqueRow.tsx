import PressableScale from "@/components/PressableScale";
import Button from "@/components/ui/Button";
import { Caption, Headline } from "@/components/ui/Text";
import { type AppTheme, withOpacity } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { FontAwesome5 } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";

type MosqueRowProps = {
  name: string;
  address: string;
  distanceLabel: string | null;
  selected?: boolean;
  onPress: () => void;
  onDirections: () => void;
};

export default function MosqueRow({
  name,
  address,
  distanceLabel,
  selected,
  onPress,
  onDirections,
}: MosqueRowProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const meta = distanceLabel ?? "";

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Select ${name}`}
      accessibilityState={{ selected: !!selected }}
      style={[styles.row, selected && styles.rowSelected]}
    >
      <View style={styles.glyphCircle}>
        <FontAwesome5 name="mosque" size={18} color={colors.accent} />
      </View>

      <View style={styles.textBlock}>
        <Headline color={colors.white} numberOfLines={1}>
          {name}
        </Headline>
        <Caption color={colors.textTertiary} numberOfLines={1}>
          {address}
        </Caption>
        {meta.length > 0 && (
          <Caption color={colors.textTertiary}>{meta}</Caption>
        )}
      </View>

      <Button
        label="Directions"
        icon="navigate"
        size="sm"
        onPress={onDirections}
        accessibilityLabel={`Directions to ${name}`}
      />
    </PressableScale>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;

  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 4,
      minHeight: 64,
      borderRadius: theme.radii.row,
      borderCurve: "continuous",
      borderWidth: 1,
      backgroundColor: withOpacity(colors.white, 0.05),
      borderColor: withOpacity(colors.white, 0.09),
    },
    rowSelected: {
      backgroundColor: withOpacity(colors.accent, 0.08),
      borderColor: withOpacity(colors.accent, 0.4),
    },
    glyphCircle: {
      width: 42,
      height: 42,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withOpacity(colors.accent, 0.16),
      borderWidth: 1,
      borderColor: withOpacity(colors.accent, 0.3),
    },
    textBlock: {
      flex: 1,
      gap: 2,
    },
  });
};
