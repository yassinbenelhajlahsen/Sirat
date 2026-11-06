import PressableScale from "@/components/PressableScale";
import Button from "@/components/ui/Button";
import GlassSurface from "@/components/ui/GlassSurface";
import IconButton from "@/components/ui/IconButton";
import Segmented from "@/components/ui/Segmented";
import AppIcon from "@/components/ui/AppIcon";
import { Caption, Footnote, Subhead } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import { useSavedDuas } from "@/hooks/useSavedDuas";
import type { Dua, DuaNotice } from "@/services/duaService";
import React from "react";
import { Alert, Clipboard, ScrollView, Share, StyleSheet, Text, View } from "react-native";

interface DuaResultCardProps {
  dua: Dua;
  onClose: () => void;
  onAnother?: () => void;
  /** Shown above the dua. Screen-only; the saved dua never carries it. */
  notice?: DuaNotice;
  onBrowse?: () => void;
  /** The screen owns the "Copied" toast so it can sit below the status bar. */
  onCopied?: () => void;
  /** Sends a wrong-dua report. Omit when there is no typed request behind the dua. */
  onReport?: () => Promise<void>;
}

export const CRISIS_MESSAGE =
  "You don't have to face this alone. If you might hurt yourself, or someone is hurting you, call your local emergency number or a crisis line now, and reach out to someone you trust.";
export const NO_MATCH_MESSAGE = "We couldn't find a close match.";

type Mode = "translation" | "transliteration";

function DuaResultCard({ dua, onClose, onAnother, notice = null, onBrowse, onCopied, onReport }: DuaResultCardProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const haptic = useHaptics();
  const { isSaved, toggle } = useSavedDuas();
  const saved = isSaved(dua.id);

  const [mode, setMode] = React.useState<Mode>("translation");
  // Keyed by dua id so "Find another dua" resets the report state for the new dua.
  const [report, setReport] = React.useState<{ id: number; state: "sending" | "sent" | "failed" } | null>(null);
  const reportState = report?.id === dua.id ? report.state : null;

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
    onCopied?.();
  };

  const handleToggleSave = () => {
    haptic("light");
    void toggle(dua.id);
  };

  const sendReport = async () => {
    if (!onReport) return;
    const id = dua.id;
    setReport({ id, state: "sending" });
    try {
      await onReport();
      haptic("success");
      setReport({ id, state: "sent" });
    } catch {
      setReport({ id, state: "failed" });
    }
  };

  const handleReport = () => {
    haptic("light");
    Alert.alert("Report a poor match?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Send", onPress: () => void sendReport() },
    ]);
  };

  const handleAnother = () => {
    haptic("light");
    onAnother?.();
  };

  return (
    <View style={styles.wrapper}>
      <GlassSurface tier="card" radius={theme.radii.card} style={styles.card}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {notice === "crisis" ? (
            <View
              style={styles.crisisBox}
              accessible
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              accessibilityLabel={CRISIS_MESSAGE}
            >
              <Subhead color={colors.white}>{CRISIS_MESSAGE}</Subhead>
            </View>
          ) : null}

          {notice === "no-match" ? (
            <View style={styles.noMatchBox}>
              <Subhead color={colors.textSecondary} style={styles.noMatchText}>{NO_MATCH_MESSAGE}</Subhead>
              {onBrowse ? (
                <Button
                  label="Browse all duas"
                  icon="book-outline"
                  variant="tonal"
                  onPress={() => {
                    haptic("light");
                    onBrowse();
                  }}
                  accessibilityLabel="Browse all duas"
                  style={styles.browseButton}
                />
              ) : null}
            </View>
          ) : null}

          <View style={styles.headerRow}>
            <Footnote color={colors.textTertiary}>{categoryLabel}</Footnote>

            <View style={styles.headerButtons}>
              <IconButton
                icon={saved ? "bookmark" : "bookmark-outline"}
                size={32}
                iconSize={18}
                onPress={handleToggleSave}
                accessibilityLabel={saved ? "Remove from saved duas" : "Save dua"}
              />
              <IconButton
                icon="close"
                size={32}
                iconSize={18}
                onPress={onClose}
                accessibilityLabel="Close dua details"
              />
            </View>
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

          {onReport && notice !== "crisis" ? (
            reportState === "sent" ? (
              <View style={styles.reportRow} accessible accessibilityLiveRegion="polite">
                <AppIcon name="checkmark-circle" size={12} color={colors.textTertiary} />
                <Caption color={colors.textTertiary}>Thanks, this helps us improve matching.</Caption>
              </View>
            ) : (
              <>
                <PressableScale
                  onPress={handleReport}
                  disabled={reportState === "sending"}
                  hitSlop={10}
                  style={styles.reportRow}
                  accessibilityRole="button"
                  accessibilityLabel="Report this dua as a poor match"
                >
                  <AppIcon name="flag-outline" size={12} color={colors.textTertiary} />
                  <Caption color={colors.textTertiary}>
                    {reportState === "sending" ? "Sending" : "Wrong dua for this?"}
                  </Caption>
                </PressableScale>
                {reportState === "failed" ? (
                  <Caption color={colors.textTertiary} style={styles.reportError}>
                    {"Couldn't send. Try again."}
                  </Caption>
                ) : null}
              </>
            )
          ) : null}
        </ScrollView>
      </GlassSurface>
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
    crisisBox: {
      padding: spacing.md,
      marginBottom: spacing.md,
      borderRadius: theme.radii.row,
      backgroundColor: withOpacity(colors.accent, 0.14),
      borderWidth: 1,
      borderColor: withOpacity(colors.accent, 0.4),
    },
    noMatchBox: {
      marginBottom: spacing.md,
      gap: spacing.sm,
      alignItems: "center",
    },
    noMatchText: {
      textAlign: "center",
    },
    browseButton: {
      alignSelf: "center",
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    headerButtons: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
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
      borderRadius: theme.radii.pill,
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
    reportRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
      gap: spacing.xs,
      minHeight: 24,
    },
    reportError: {
      textAlign: "center",
    },
  });
};

export default DuaResultCard;
