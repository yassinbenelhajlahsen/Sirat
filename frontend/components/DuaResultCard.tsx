import CopyToast from "@/components/CopyToast";
import Button from "@/components/ui/Button";
import GlassSurface from "@/components/ui/GlassSurface";
import IconButton from "@/components/ui/IconButton";
import { Caption, Subhead } from "@/components/ui/Text";
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

  const segment = (key: Mode, label: string) => {
    const active = mode === key;
    return (
      <Pressable
        onPress={() => setMode(key)}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        style={styles.segmentBtn}
      >
        <Caption color={active ? colors.accent : colors.textSecondary} style={styles.segmentText}>
          {label}
        </Caption>
      </Pressable>
    );
  };

  return (
    <View style={styles.wrapper}>
      <GlassSurface tier="card" radius={theme.radii.card} style={styles.card}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <Caption color={colors.accent} style={styles.eyebrow}>
              {categoryLabel}
            </Caption>

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
            <Ionicons name="sparkles" size={13} color={withOpacity(colors.accent, 0.7)} />
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

          <View
            style={styles.segment}
            accessibilityRole="tablist"
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
            {segment("translation", "Translation")}
            {segment("transliteration", "Transliteration")}
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
      justifyContent: "center",
      minHeight: 36,
      borderRadius: 9,
      zIndex: 1,
    },
    segmentText: {
      fontWeight: "600",
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
      gap: 8,
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
