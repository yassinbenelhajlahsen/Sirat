import { colors, spacing, typography, withOpacity } from "@/constants/theme";
import type { Dua } from "@/services/duaService";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
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
  onSaveBookmark?: () => Promise<void>;
}

function DuaResultCard({ dua, onClose, onSaveBookmark }: DuaResultCardProps) {
  const [bookmarkLoading, setBookmarkLoading] = React.useState(false);

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

  const handleBookmark = async () => {
    if (!onSaveBookmark) return;

    try {
      setBookmarkLoading(true);
      await onSaveBookmark();
    } catch (err: any) {
      console.error("Bookmark error:", err);
    } finally {
      setBookmarkLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header with close button */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.category}>
              {dua.category.charAt(0).toUpperCase() + dua.category.slice(1)}
            </Text>
          </View>

          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close dua details"
          >
            <Ionicons
              name="close-circle-outline"
              size={24}
              color={colors.white}
            />
          </Pressable>
        </View>

        {/* Arabic Text - Main Display */}
        <View style={styles.arabicContainer}>
          <Text style={styles.arabicText}>
            {dua.arabic}
          </Text>
        </View>

        {/* Transliteration */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>
            Transliteration
          </Text>
          <Text style={styles.sectionValue}>
            {dua.transliteration}
          </Text>
        </View>

        {/* English Translation */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>
            English Translation
          </Text>
          <Text style={styles.sectionValue}>
            {dua.english}
          </Text>
        </View>

        {/* Reference & Source */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>
              Reference
            </Text>
            <Text style={styles.metaValue}>
              {dua.reference}
            </Text>
          </View>

          <View style={styles.metaItemRight}>
            <Text style={styles.metaLabel}>
              Source
            </Text>
            <Text style={styles.metaValue}>
              {dua.source}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          {/* Share Button */}
          <Pressable
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel="Share dua"
            style={styles.actionButton}
          >
            <Ionicons
              name="share-social-outline"
              size={16}
              color={colors.accent}
            />
            <Text style={styles.actionButtonText}>
              Share
            </Text>
          </Pressable>

          {/* Bookmark Button */}
          {onSaveBookmark && (
            <Pressable
              onPress={handleBookmark}
              disabled={bookmarkLoading}
              accessibilityRole="button"
              accessibilityLabel="Save dua"
              style={styles.actionButton}
            >
              {bookmarkLoading ? (
                <Ionicons
                  name="bookmark-outline"
                  size={16}
                  color={colors.grayMuted}
                />
              ) : (
                <Ionicons
                  name="bookmark-outline"
                  size={16}
                  color={colors.accent}
                />
              )}
              <Text
                style={[
                  styles.actionButtonText,
                  bookmarkLoading ? styles.actionButtonTextMuted : undefined,
                ]}
              >
                Save
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
    backgroundColor: withOpacity(colors.black, 0.2),
    borderRadius: 18,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: withOpacity(colors.white, 0.08),
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 6,
    position: "relative",
    zIndex: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  category: {
    color: colors.accent,
    fontSize: typography.caption,
    fontFamily: "SFProDisplay-Regular",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  arabicContainer: {
    marginBottom: spacing.lg,
    alignItems: "center",
  },
  arabicText: {
    color: colors.accent,
    fontSize: 26,
    fontFamily: "SFProDisplay-Bold",
    textAlign: "right",
    lineHeight: 42,
    marginBottom: spacing.sm,
  },
  sectionCard: {
    marginBottom: spacing.md,
    backgroundColor: withOpacity(colors.black, 0.25),
    padding: spacing.md,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: withOpacity(colors.white, 0.15),
  },
  sectionLabel: {
    color: colors.grayMedium,
    fontSize: 11,
    fontFamily: "SFProDisplay-Regular",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  sectionValue: {
    color: colors.white,
    fontSize: 13,
    fontFamily: "SFProDisplay-Regular",
    marginTop: 6,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: withOpacity(colors.white, 0.1),
  },
  metaItem: {
    flex: 1,
  },
  metaItemRight: {
    flex: 1,
    alignItems: "flex-end",
  },
  metaLabel: {
    color: colors.grayMuted,
    fontSize: 10,
    fontFamily: "SFProDisplay-Regular",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  metaValue: {
    color: colors.accent,
    fontSize: 13,
    fontFamily: "SFProDisplay-Semibold",
    marginTop: spacing.xs,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withOpacity(colors.black, 0.25),
    borderRadius: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: withOpacity(colors.white, 0.15),
    shadowColor: withOpacity(colors.black, 0.15),
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  actionButtonText: {
    color: colors.accent,
    fontSize: 13,
    fontFamily: "SFProDisplay-Semibold",
    marginLeft: 6,
  },
  actionButtonTextMuted: {
    color: colors.grayMuted,
  },
});

export default DuaResultCard;
