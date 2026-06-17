import GlassSurface from "@/components/ui/GlassSurface";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { Dua } from "@/services/duaService";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";

interface DuaResultCardProps {
  dua: Dua;
  onClose: () => void;
}

function DuaResultCard({ dua, onClose}: DuaResultCardProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = React.useMemo(() => createStyles(theme), [theme]);

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


  return (
    <GlassSurface tier="card" radius={theme.radii.card} style={styles.card}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.categoryBadge}>
            <Text style={styles.category}>
              {dua.category.charAt(0).toUpperCase() + dua.category.slice(1)}
            </Text>
          </View>

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

        <View style={styles.arabicContainer}>
          <Text style={styles.arabicText}>
            {dua.arabic}
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>
            Transliteration
          </Text>
          <Text style={styles.sectionValue}>
            {dua.transliteration}
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>
            English Translation
          </Text>
          <Text style={styles.sectionValue}>
            {dua.english}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaCardLeft}>
            <Text style={styles.metaLabel}>
              Reference
            </Text>
            <Text style={styles.metaValue}>
              {dua.reference}
            </Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel="Share dua"
            style={styles.actionButton}
          >
            <Ionicons name="share-social-outline" size={16} color={colors.onAccent} />
            <Text style={styles.actionButtonText}>
              Share
            </Text>
          </Pressable>

        </View>
      </ScrollView>
    </GlassSurface>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing, typography } = theme;
  const isLight = theme.name === "light";

  return StyleSheet.create({
    card: {
      marginTop: spacing.lg,
      padding: spacing.xl,
      shadowColor: colors.primaryDark,
      shadowOpacity: isLight ? 0.22 : 0.28,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: isLight ? 10 : 12 },
      elevation: 4,
      position: "relative",
      zIndex: 1,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.lg,
    },
    categoryBadge: {
      backgroundColor: withOpacity(colors.accent, 0.12),
      borderWidth: 1,
      borderColor: withOpacity(colors.accent, 0.35),
      borderRadius: 999,
      paddingVertical: 5,
      paddingHorizontal: 10,
    },
    category: {
      color: withOpacity(colors.accent, 0.96),
      fontSize: typography.caption,
      fontFamily: "SFProDisplay-Semibold",
      textTransform: "uppercase",
      letterSpacing: 0.5,
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
    arabicContainer: {
      marginBottom: spacing.lg,
      alignItems: "center",
      backgroundColor: isLight
        ? withOpacity(colors.primarySurfaceAlt, 0.4)
        : withOpacity(colors.white, 0.05),
      borderRadius: 14,
      borderWidth: 1,
      borderColor: withOpacity(colors.accent, 0.22),
      paddingVertical: spacing.md + 2,
      paddingHorizontal: spacing.md,
    },
    arabicText: {
      color: colors.accent,
      fontSize: 28,
      fontFamily: "SFProDisplay-Bold",
      textAlign: "right",
      lineHeight: 44,
    },
    sectionCard: {
      marginBottom: spacing.md,
      backgroundColor: isLight
        ? withOpacity(colors.primarySurfaceAlt, 0.24)
        : withOpacity(colors.white, 0.05),
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isLight
        ? withOpacity(colors.accent, 0.2)
        : withOpacity(colors.white, 0.12),
    },
    sectionLabel: {
      color: withOpacity(colors.white, 0.65),
      fontSize: 11,
      fontFamily: "SFProDisplay-Semibold",
      textTransform: "uppercase",
      letterSpacing: 0.35,
    },
    sectionValue: {
      color: colors.white,
      fontSize: typography.body,
      fontFamily: "SFProDisplay-Regular",
      marginTop: 6,
      lineHeight: 20,
    },
    metaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: spacing.lg,
    },
    metaCardLeft: {
      width: "100%",
      backgroundColor: isLight
        ? withOpacity(colors.primarySurfaceAlt, 0.24)
        : withOpacity(colors.white, 0.05),
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isLight
        ? withOpacity(colors.accent, 0.2)
        : withOpacity(colors.white, 0.12),
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.sm + 2,
    },
    metaLabel: {
      color: withOpacity(colors.white, 0.62),
      fontSize: 10,
      fontFamily: "SFProDisplay-Regular",
      textTransform: "uppercase",
      letterSpacing: 0.35,
    },
    metaValue: {
      color: colors.accent,
      fontSize: typography.body,
      fontFamily: "SFProDisplay-Semibold",
      marginTop: 4,
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    actionButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accent,
      borderRadius: 11,
      paddingVertical: spacing.sm + 3,
      borderWidth: 1,
      borderColor: withOpacity(colors.accent, 0.4),
      shadowColor: withOpacity(colors.accent, 0.35),
      shadowOpacity: 0.2,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },
    actionButtonSpaced: {
      marginLeft: spacing.sm,
    },
    actionButtonText: {
      color: colors.onAccent,
      fontSize: 13,
      fontFamily: "SFProDisplay-Bold",
      marginLeft: 6,
    },
    actionButtonTextMuted: {
      color: withOpacity(colors.onAccent, 0.45),
    },
  });
};

export default DuaResultCard;
