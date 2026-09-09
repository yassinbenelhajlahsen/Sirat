import { Ionicons } from "@expo/vector-icons";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import Button from "@/components/ui/Button";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { NormalizedAyah, NormalizedSurahMeta } from "@/services/quranData";
import SurahBanner from "@/components/quran/SurahBanner";

type QuranAyahCardProps = {
  ayah: NormalizedAyah;
  isSurahStart: boolean;
  surahMeta?: NormalizedSurahMeta;
  showArabic?: boolean;
  showEnglish?: boolean;
  showTransliteration?: boolean;
  isBookmarked?: boolean;
  /** Reader text size multiplier from the display settings sheet. */
  textScale?: number;
  onBookmark?: () => void;
  onCopy?: () => void;
  onLongPress?: () => void;
};

// Base reading sizes at textScale = 1.
const ARABIC_SIZE = 31;
const ARABIC_LINE = 48;
const TRANSLIT_SIZE = 14;
const TRANSLIT_LINE = 22;
const TRANSLATION_SIZE = 15;
const TRANSLATION_LINE = 23;

/**
 * One ayah in the reader. A tap reveals a visible action row (Bookmark, Copy)
 * so the core actions no longer hide behind double-tap; long press still jumps
 * straight to the copy sheet as a shortcut.
 */
function QuranAyahCard({
  ayah,
  isSurahStart,
  surahMeta,
  showArabic = true,
  showEnglish = true,
  showTransliteration = false,
  isBookmarked = false,
  textScale = 1,
  onBookmark,
  onCopy,
  onLongPress,
}: QuranAyahCardProps) {
  const { theme } = useTheme();
  const themeColors = theme.colors;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const arabicName = surahMeta?.arabicName ?? ayah.surahNameAr;
  const englishName = surahMeta?.englishName ?? ayah.surahNameEn;
  const shouldShowArabic = showArabic && Boolean(ayah.arabicText);
  const shouldShowEnglish = showEnglish && Boolean(ayah.englishText);
  const shouldShowTransliteration =
    showTransliteration && Boolean(ayah.transliteration);
  const hasActions = Boolean(onBookmark || onCopy);

  const [actionsOpen, setActionsOpen] = useState(false);
  const holdScale = useRef(new Animated.Value(1)).current;

  const sized = useMemo(
    () => ({
      arabic: { fontSize: ARABIC_SIZE * textScale, lineHeight: ARABIC_LINE * textScale },
      transliteration: {
        fontSize: TRANSLIT_SIZE * textScale,
        lineHeight: TRANSLIT_LINE * textScale,
      },
      translation: {
        fontSize: TRANSLATION_SIZE * textScale,
        lineHeight: TRANSLATION_LINE * textScale,
      },
    }),
    [textScale],
  );

  const handlePressIn = useCallback(() => {
    Animated.spring(holdScale, {
      toValue: 0.975,
      speed: 40,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  }, [holdScale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(holdScale, {
      toValue: 1,
      speed: 30,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  }, [holdScale]);

  const toggleActions = useCallback(() => setActionsOpen((open) => !open), []);

  const handleBookmark = useCallback(() => {
    setActionsOpen(false);
    onBookmark?.();
  }, [onBookmark]);

  const handleCopy = useCallback(() => {
    setActionsOpen(false);
    onCopy?.();
  }, [onCopy]);

  return (
    <View style={styles.container}>
      {isSurahStart ? (
        <SurahBanner arabicName={arabicName} englishName={englishName} />
      ) : (
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
        </View>
      )}

      <Animated.View style={{ transform: [{ scale: holdScale }] }}>
        <Pressable
          style={[styles.ayahBlock, actionsOpen && hasActions && styles.ayahBlockActive]}
          onPress={hasActions ? toggleActions : undefined}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onLongPress={onLongPress}
          delayLongPress={400}
          accessibilityRole="button"
          accessibilityLabel={`Ayah ${ayah.ayahNumber} from Surah ${ayah.surahNumber}`}
          accessibilityHint={hasActions ? "Shows bookmark and copy actions" : undefined}
          accessibilityState={hasActions ? { expanded: actionsOpen } : undefined}
        >
          {isBookmarked ? (
            <View style={styles.bookmarkBadge}>
              <Ionicons name="bookmark" size={16} color={themeColors.accent} />
            </View>
          ) : null}
          {shouldShowArabic ? (
            <Text
              style={[
                styles.arabic,
                sized.arabic,
                (shouldShowEnglish || shouldShowTransliteration) &&
                  styles.textBlockSpacing,
              ]}
              allowFontScaling={false}
              // @ts-expect-error includeFontPadding is available on React Native Text for Android layout
              includeFontPadding={false}
              textBreakStrategy="highQuality"
            >
              {ayah.arabicText}
            </Text>
          ) : null}
          {shouldShowTransliteration ? (
            <Text
              style={[
                styles.transliteration,
                sized.transliteration,
                shouldShowEnglish && styles.textBlockSpacing,
              ]}
              maxFontSizeMultiplier={1.3}
            >
              {ayah.transliteration}
            </Text>
          ) : null}
          {shouldShowEnglish ? (
            <Text style={[styles.translation, sized.translation]} maxFontSizeMultiplier={1.3}>
              {ayah.englishText}
            </Text>
          ) : null}
        </Pressable>
      </Animated.View>

      {actionsOpen && hasActions ? (
        <View style={styles.actionsRow}>
          {onBookmark ? (
            <Button
              label={isBookmarked ? "Bookmarked" : "Bookmark"}
              icon={isBookmarked ? "bookmark" : "bookmark-outline"}
              variant={isBookmarked ? "primary" : "tonal"}
              onPress={handleBookmark}
              accessibilityLabel={isBookmarked ? "View bookmark" : "Bookmark this ayah"}
            />
          ) : null}
          {onCopy ? (
            <Button
              label="Copy"
              icon="copy-outline"
              variant="tonal"
              onPress={handleCopy}
              accessibilityLabel="Copy this ayah"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default memo(QuranAyahCard);

const createStyles = (theme: AppTheme) => {
  const themeColors = theme.colors;

  return StyleSheet.create({
    container: {
      marginBottom: 22,
    },

    /* DIVIDER (between ayahs, not surah start) */
    divider: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      opacity: 0.45,
      marginTop: theme.spacing.sm,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: withOpacity(themeColors.white, 0.16) },

    /* AYAH BLOCK */
    ayahBlock: {
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radii.row,
      borderCurve: "continuous",
    },
    ayahBlockActive: {
      backgroundColor: withOpacity(themeColors.white, 0.05),
    },

    /* BOOKMARK BADGE */
    bookmarkBadge: {
      position: "absolute",
      top: 10,
      left: 10,
      backgroundColor: withOpacity(themeColors.accent, 0.14),
      borderRadius: 999,
      padding: 6,
      borderWidth: 1,
      borderColor: withOpacity(themeColors.accent, 0.3),
    },

    /* ARABIC */
    arabic: {
      textAlign: "right",
      writingDirection: "rtl",
      color: themeColors.white,
      letterSpacing: 0.2,
    },

    textBlockSpacing: {
      marginBottom: 13,
    },

    /* TRANSLITERATION */
    transliteration: {
      color: themeColors.textSecondary,
      textAlign: "center",
      fontStyle: "italic",
    },

    /* TRANSLATION */
    translation: {
      color: themeColors.white,
      opacity: 0.92,
      textAlign: "left",
    },

    /* INLINE ACTIONS */
    actionsRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
    },
  });
};
