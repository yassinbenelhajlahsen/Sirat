import CopyToast from "@/components/CopyToast";
import Button from "@/components/ui/Button";
import GlassSurface from "@/components/ui/GlassSurface";
import IconButton from "@/components/ui/IconButton";
import Segmented from "@/components/ui/Segmented";
import AppIcon from "@/components/ui/AppIcon";
import { Caption, Footnote, Subhead } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import type { Dua } from "@/services/duaService";
import React from "react";
import { Clipboard, ScrollView, Share, StyleSheet, Text, View } from "react-native";

interface DuaResultCardProps {
  dua: Dua;
  onClose: () => void;
  onAnother?: () => void;
}

type Mode = "translation" | "transliteration";

function DuaResultCard({ dua, onClose, onAnother }: DuaResultCardProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const haptic = useHaptics();

  const [mode, setMode] = React.useState<Mode>("translation");
  const [toastVisible, setToastVisible] = React.useState(false);

  // Stable so CopyToast's auto-dismiss timer isn't reset on every Home re-render.
  const hideToast = React.useCallback(() => setToastVisible(false), []);

  // Category values are snake_case keys (e.g. "after_prayer", "drinking_water").
  // Render them as title-cased words so the underscore never reaches the UI.
  const categoryLabel = dua.category
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  const fullText = `${dua.arabic}\n\n${dua.transliteration}\n\n${dua.english}\n\n— ${dua.reference}`;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this dua 🤲:\n\n${dua.arabic}\n\n${dua.transliteration}\n\n${dua.english}\n\n— ${dua.reference}`,
        title: "Islamic Dua",
      });
    } catch (err) {
      console.error("Share error:", err);
    }
  };

  const handleCopy = () => {
    Clipboard?.setString?.(fullText);
    haptic("light");
    setToastVisible(true);
  };

  const handleAnother = () => {
    haptic("light");
    onAnother?.();
  };

  return (
    <View style={styles.wrapper}>
      <GlassSurface tier="card" radius={theme.radii.card} style={styles.card}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <Footnote color={colors.textTertiary}>{categoryLabel}</Footnote>

            <IconButton
              icon="close"
              size={32}
              iconSize={18}
              onPress={onClose}
              accessibilityLabel="Close dua details"
            />
          </View>

          <View style={styles.flourish}>
            <View style={styles.flourishLine} />
            <AppIcon name="sparkles" size={13} color={withOpacity(colors.accent, 0.7)} />
            <View style={styles.flourishLine} />
          </View>

          <Text style={styles.arabicText} maxFontSizeMultiplier={1.3}>
            {dua.arabic}
          </Text>

          <View style={styles.flourish}>
            <View style={styles.flourishLineShort} />
            <View style={styles.flourishDot} />
            <View style={styles.flourishLineShort} />
          </View>

          <View style={styles.segment}>
            <Segmented
              options={[
                { value: "translation", label: "Translation" },
                { value: "transliteration", label: "Transliteration" },
              ]}
              value={mode}
              onChange={setMode}
              accessibilityLabel="Dua text mode"
            />
          </View>

          <Subhead color={colors.white} style={styles.bodyValue}>
            {mode === "translation" ? dua.english : dua.transliteration}
          </Subhead>

          <View style={styles.referenceRow}>
            <Caption color={colors.textTertiary}>Reference · </Caption>
            <Caption color={colors.accent} style={styles.referenceValue}>
              {dua.reference}
            </Caption>
          </View>

          <View style={styles.actions}>
            <Button
              label="Copy"
              icon="copy-outline"
              variant="tonal"
              onPress={handleCopy}
              accessibilityLabel="Copy dua"
              style={styles.actionButton}
            />
            <Button
              label="Share"
              icon="share-social-outline"
              onPress={handleShare}
              accessibilityLabel="Share dua"
              style={styles.actionButton}
            />
          </View>

          {onAnother ? (
            <Button
              label="Find another dua"
              icon="refresh"
              variant="ghost"
              onPress={handleAnother}
              accessibilityLabel="Find another dua"
              style={styles.anotherButton}
            />
          ) : null}
        </ScrollView>
      </GlassSurface>

      <CopyToast visible={toastVisible} onHide={hideToast} />
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;

  return StyleSheet.create({
    wrapper: {
      position: "relative",
    },
    card: {
      padding: spacing.lg,
      position: "relative",
      zIndex: 1,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    flourish: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginVertical: spacing.sm,
    },
    flourishLine: {
      height: 1,
      width: 46,
      backgroundColor: withOpacity(colors.accent, 0.3),
    },
    flourishLineShort: {
      height: 1,
      width: 34,
      backgroundColor: withOpacity(colors.accent, 0.22),
    },
    flourishDot: {
      width: 5,
      height: 5,
      borderRadius: 999,
      backgroundColor: withOpacity(colors.accent, 0.5),
    },
    arabicText: {
      color: colors.white,
      fontSize: 26,
      fontWeight: "600",
      textAlign: "center",
      lineHeight: 44,
    },
    segment: {
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    bodyValue: {
      marginBottom: spacing.md,
    },
    referenceRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.lg,
    },
    referenceValue: {
      fontWeight: "600",
    },
    actions: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    actionButton: {
      flex: 1,
    },
    anotherButton: {
      marginTop: spacing.sm,
    },
  });
};

export default DuaResultCard;
