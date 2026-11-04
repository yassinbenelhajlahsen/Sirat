import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import GlassSurface from "@/components/ui/GlassSurface";
import IconButton from "@/components/ui/IconButton";
import { Caption, Subhead } from "@/components/ui/Text";
import type { AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import { useSavedDuas } from "@/hooks/useSavedDuas";
import type { Dua } from "@/services/duaService";

/** One dua in full for the library lists: Arabic, transliteration, translation, reference. */
export default function DuaEntry({ dua }: { dua: Dua }) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const haptic = useHaptics();
  const { isSaved, toggle } = useSavedDuas();
  const saved = isSaved(dua.id);

  return (
    <GlassSurface tier="card" radius={theme.radii.card} style={styles.card}>
      <View style={styles.saveButton}>
        <IconButton
          icon={saved ? "bookmark" : "bookmark-outline"}
          size={32}
          iconSize={18}
          onPress={() => {
            haptic("light");
            void toggle(dua.id);
          }}
          accessibilityLabel={saved ? "Remove from saved duas" : "Save dua"}
        />
      </View>
      <Text style={styles.arabic} maxFontSizeMultiplier={1.3}>
        {dua.arabic}
      </Text>
      <Subhead color={colors.textSecondary} style={styles.transliteration}>
        {dua.transliteration}
      </Subhead>
      <Subhead color={colors.white}>{dua.english}</Subhead>
      <Caption color={colors.accent} style={styles.reference}>
        {dua.reference}
      </Caption>
    </GlassSurface>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    card: { padding: spacing.lg, gap: spacing.sm },
    saveButton: { alignSelf: "flex-end", marginBottom: -spacing.sm },
    arabic: {
      color: colors.white,
      fontSize: 24,
      fontWeight: "600",
      textAlign: "right",
      writingDirection: "rtl",
      lineHeight: 40,
    },
    transliteration: { fontStyle: "italic" },
    reference: { fontWeight: "600", marginTop: spacing.xs },
  });
};
