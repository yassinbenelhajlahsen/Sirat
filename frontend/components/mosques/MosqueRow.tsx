import PressableScale from "@/components/PressableScale";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import { Body, Footnote, Subhead } from "@/components/ui/Text";
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
  /** Rows after the first draw a hairline inset to the text edge. */
  separated?: boolean;
  onPress: () => void;
  onDirections: () => void;
};

export default function MosqueRow({
  name,
  address,
  distanceLabel,
  selected,
  separated,
  onPress,
  onDirections,
}: MosqueRowProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <PressableScale
      variant="row"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Select ${name}`}
      accessibilityState={{ selected: !!selected }}
      style={styles.wrap}
    >
      {separated ? <View pointerEvents="none" style={styles.separator} /> : null}
      <View style={styles.row}>
        <View style={styles.glyphCircle}>
          <FontAwesome5 name="mosque" size={18} color={colors.accent} />
        </View>

        <View style={styles.textBlock}>
          <Body color={colors.white} numberOfLines={1}>
            {name}
          </Body>
          <Footnote color={colors.textTertiary} numberOfLines={1}>
            {address}
          </Footnote>
        </View>

        {distanceLabel ? (
          <Subhead color={colors.textTertiary}>{distanceLabel}</Subhead>
        ) : null}

        <IconButton
          icon="navigate"
          variant="tonal"
          size={36}
          iconSize={16}
          color={colors.accent}
          onPress={onDirections}
          accessibilityLabel={`Directions to ${name}`}
        />
      </View>

      {/* The selected row grows a full-width primary action under its text. */}
      {selected ? (
        <Button
          label="Directions"
          icon="navigate"
          onPress={onDirections}
          accessibilityLabel={`Open directions to ${name}`}
          style={styles.selectedAction}
        />
      ) : null}
    </PressableScale>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  const GLYPH = 42;

  return StyleSheet.create({
    wrap: { paddingBottom: spacing.sm },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
      minHeight: 64,
    },
    // Inset to the text edge: the glyph circle plus its gap.
    separator: {
      position: "absolute",
      top: 0,
      left: GLYPH + spacing.md,
      right: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: withOpacity(colors.white, 0.1),
    },
    glyphCircle: {
      width: GLYPH,
      height: GLYPH,
      borderRadius: theme.radii.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withOpacity(colors.accent, 0.16),
    },
    textBlock: { flex: 1, gap: 2 },
    selectedAction: { marginBottom: spacing.sm },
  });
};
