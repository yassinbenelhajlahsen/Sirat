// frontend/components/chat/CitationCard.tsx
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import PressableScale from "@/components/PressableScale";
import { Body, Caption, Footnote, Subhead, TEXT_MAX_FONT_SCALE } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { Citation } from "@/services/chat/chatApi";

type Props = { citation: Citation };

export default function CitationCard({ citation }: Props) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (citation.kind === "quran") {
    const { surah, ayah, arabic, english } = citation;
    const reference = `Quran ${surah}:${ayah}`;
    return (
      <PressableScale
        variant="card"
        radius={theme.radii.row}
        accessibilityRole="button"
        accessibilityLabel={`Open ${reference}`}
        onPress={() => {
          router.back();
          // A new stamp per tap, so the Quran tab scrolls again when the same verse is opened twice.
          router.push({ pathname: "/(tabs)/Quran", params: { surah, ayah, at: String(Date.now()) } });
        }}
        style={styles.card}
      >
        <Caption color={colors.accent}>{reference}</Caption>
        <Text style={styles.arabic} maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}>
          {arabic}
        </Text>
        {english ? <Subhead color={colors.textSecondary}>{english}</Subhead> : null}
      </PressableScale>
    );
  }

  if (citation.kind === "hadith") {
    return (
      <View style={styles.card}>
        <Subhead color={colors.white} style={styles.bold}>
          {citation.title}
        </Subhead>
        <Body color={colors.textSecondary}>{citation.text}</Body>
        <Footnote color={colors.textTertiary}>{citation.grade}</Footnote>
        <Caption color={colors.textTertiary}>{`${citation.source} · ${citation.credit}`}</Caption>
      </View>
    );
  }

  if (citation.kind === "dua") {
    return (
      <View style={styles.card}>
        <Text style={styles.arabic} maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}>
          {citation.arabic}
        </Text>
        <Body color={colors.textSecondary} style={styles.italic}>
          {citation.transliteration}
        </Body>
        <Subhead color={colors.white}>{citation.english}</Subhead>
        <Caption color={colors.textTertiary}>{citation.reference}</Caption>
      </View>
    );
  }

  return null;
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    card: {
      padding: theme.spacing.md,
      gap: theme.spacing.xs,
      borderRadius: theme.radii.row,
      backgroundColor: withOpacity(theme.colors.white, 0.08),
    },
    arabic: {
      color: theme.colors.white,
      fontFamily: "Amiri",
      fontSize: 22,
      lineHeight: 36,
      textAlign: "right",
      writingDirection: "rtl",
    },
    bold: { fontWeight: "600" },
    italic: { fontStyle: "italic" },
  });
