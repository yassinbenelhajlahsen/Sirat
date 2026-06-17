import PressableScale from "@/components/PressableScale";
import { Caption, Headline } from "@/components/ui/Text";
import { type AppTheme, withOpacity } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

type MosqueRowProps = {
  name: string;
  address: string;
  distanceLabel: string | null;
  direction: string | null;
  selected?: boolean;
  onPress: () => void;
  onDirections: () => void;
};

export default function MosqueRow({
  name,
  address,
  distanceLabel,
  direction,
  selected,
  onPress,
  onDirections,
}: MosqueRowProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const meta = [distanceLabel, direction].filter(Boolean).join(" · ");

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Select ${name}`}
      style={[styles.row, selected && styles.rowSelected]}
    >
      <View style={styles.glyphCircle}>
        <FontAwesome5 name="mosque" size={18} color={colors.accent} />
      </View>

      <View style={styles.textBlock}>
        <Headline color={colors.white} numberOfLines={1}>
          {name}
        </Headline>
        <Caption color={withOpacity(colors.white, 0.6)} numberOfLines={1}>
          {address}
        </Caption>
        {meta.length > 0 && (
          <Caption color={withOpacity(colors.white, 0.45)}>{meta}</Caption>
        )}
      </View>

      <Pressable
        onPress={onDirections}
        accessibilityRole="button"
        accessibilityLabel={`Directions to ${name}`}
        style={styles.chip}
      >
        <Ionicons name="navigate" size={13} color={colors.onAccent} />
        <Caption color={colors.onAccent} style={styles.chipLabel}>
          Directions
        </Caption>
      </Pressable>
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
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs + 2,
      borderRadius: theme.radii.chip,
      backgroundColor: colors.accent,
    },
    chipLabel: {
      fontFamily: "SFProDisplay-Semibold",
    } as any,
  });
};
