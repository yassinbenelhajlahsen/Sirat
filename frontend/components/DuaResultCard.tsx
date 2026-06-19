import CopyToast from "@/components/CopyToast";
import GlassSurface from "@/components/ui/GlassSurface";
import { Caption } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import type { Dua } from "@/services/duaService";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Animated,
  Clipboard,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

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
  const [segWidth, setSegWidth] = React.useState(0);

  // Stable so CopyToast's auto-dismiss timer isn't reset on every Home re-render.
  const hideToast = React.useCallback(() => setToastVisible(false), []);

  // Sliding highlight between the Translation / Transliteration segments.
  const slide = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.spring(slide, {
      toValue: mode === "translation" ? 0 : 1,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6,
    }).start();
  }, [mode, slide]);
  const indicatorWidth = Math.max(0, (segWidth - 8) / 2);
  const indicatorTranslate = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, indicatorWidth],
  });

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
            <Caption color={colors.accent} style={styles.eyebrow}>
              {categoryLabel}
            </Caption>

            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close dua details"
              style={styles.closeButton}
            >
              <Ionicons name="close" size={18} color={colors.white} />
            </Pressable>
          </View>

          <View style={styles.flourish}>
            <View style={styles.flourishLine} />
            <Ionicons name="sparkles" size={13} color={withOpacity(colors.accent, 0.7)} />
            <View style={styles.flourishLine} />
          </View>

          <Text style={styles.arabicText}>{dua.arabic}</Text>

          <View style={styles.flourish}>
            <View style={styles.flourishLineShort} />
            <View style={styles.flourishDot} />
            <View style={styles.flourishLineShort} />
          </View>

          <View
            style={styles.segment}
            onLayout={(e) => setSegWidth(e.nativeEvent.layout.width)}
          >
            {segWidth > 0 ? (
              <Animated.View
                style={[
                  styles.segmentIndicator,
                  { width: indicatorWidth, transform: [{ translateX: indicatorTranslate }] },
                ]}
              />
            ) : null}
            <Pressable
              onPress={() => setMode("translation")}
              accessibilityRole="button"
              style={styles.segmentBtn}
            >
              <Text style={[styles.segmentText, mode === "translation" && styles.segmentTextActive]}>
                Translation
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode("transliteration")}
              accessibilityRole="button"
              style={styles.segmentBtn}
            >
              <Text style={[styles.segmentText, mode === "transliteration" && styles.segmentTextActive]}>
                Transliteration
              </Text>
            </Pressable>
          </View>

          <Text style={styles.bodyValue}>
            {mode === "translation" ? dua.english : dua.transliteration}
          </Text>

          <View style={styles.referenceRow}>
            <Text style={styles.referenceLabel}>Reference · </Text>
            <Text style={styles.referenceValue}>{dua.reference}</Text>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={handleCopy}
              accessibilityRole="button"
              accessibilityLabel="Copy dua"
              style={styles.actionButton}
            >
              <Ionicons name="copy-outline" size={18} color={withOpacity(colors.white, 0.85)} />
              <Text style={styles.actionLabel}>Copy</Text>
            </Pressable>

            <Pressable
              onPress={handleShare}
              accessibilityRole="button"
              accessibilityLabel="Share dua"
              style={[styles.actionButton, styles.actionButtonPrimary]}
            >
              <Ionicons name="share-social-outline" size={18} color={colors.onAccent} />
              <Text style={[styles.actionLabel, styles.actionLabelPrimary]}>Share</Text>
            </Pressable>
          </View>

          {onAnother ? (
            <Pressable
              onPress={handleAnother}
              accessibilityRole="button"
              accessibilityLabel="Find another dua"
              style={styles.anotherButton}
            >
              <Ionicons name="refresh" size={15} color={withOpacity(colors.white, 0.78)} />
              <Text style={styles.anotherText}>Find another dua</Text>
            </Pressable>
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
      marginTop: spacing.lg,
    },
    card: {
      padding: spacing.xl,
      shadowColor: colors.primaryDark,
      shadowOpacity: theme.name === "light" ? 0.22 : 0.28,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: theme.name === "light" ? 10 : 12 },
      elevation: 4,
      position: "relative",
      zIndex: 1,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    eyebrow: {
      letterSpacing: 1.6,
      textTransform: "uppercase",
      fontWeight: "600",
    },
    closeButton: {
      width: 30,
      height: 30,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withOpacity(colors.white, 0.1),
      borderWidth: 1,
      borderColor: withOpacity(colors.white, 0.2),
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
      color: colors.accent,
      fontSize: 26,
      fontWeight: "700",
      textAlign: "center",
      lineHeight: 44,
    },
    segment: {
      position: "relative",
      flexDirection: "row",
      backgroundColor: withOpacity(colors.white, 0.05),
      borderWidth: 1,
      borderColor: withOpacity(colors.white, 0.1),
      borderRadius: 12,
      padding: 4,
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    segmentIndicator: {
      position: "absolute",
      top: 4,
      bottom: 4,
      left: 4,
      borderRadius: 9,
      backgroundColor: withOpacity(colors.accent, 0.16),
    },
    segmentBtn: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 7,
      borderRadius: 9,
      zIndex: 1,
    },
    segmentText: {
      fontSize: 12,
      fontWeight: "600",
      color: withOpacity(colors.white, 0.6),
    },
    segmentTextActive: {
      color: colors.accent,
    },
    bodyValue: {
      color: colors.white,
      fontSize: 15,
      fontWeight: "400",
      lineHeight: 22,
      marginBottom: spacing.md,
    },
    referenceRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.lg,
    },
    referenceLabel: {
      color: withOpacity(colors.white, 0.5),
      fontSize: 12,
      fontWeight: "400",
    },
    referenceValue: {
      color: withOpacity(colors.accent, 0.9),
      fontSize: 12,
      fontWeight: "600",
    },
    actions: {
      flexDirection: "row",
      gap: 8,
    },
    actionButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: spacing.sm + 3,
      borderRadius: 13,
      backgroundColor: withOpacity(colors.white, 0.06),
      borderWidth: 1,
      borderColor: withOpacity(colors.white, 0.12),
    },
    actionButtonPrimary: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
      shadowColor: withOpacity(colors.accent, 0.4),
      shadowOpacity: 0.25,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },
    actionLabel: {
      color: withOpacity(colors.white, 0.85),
      fontSize: 13,
      fontWeight: "700",
    },
    actionLabelPrimary: {
      color: colors.onAccent,
    },
    anotherButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      marginTop: spacing.md,
      paddingVertical: spacing.sm + 3,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: withOpacity(colors.white, 0.16),
    },
    anotherText: {
      color: withOpacity(colors.white, 0.78),
      fontSize: 13,
      fontWeight: "600",
    },
  });
};

export default DuaResultCard;
