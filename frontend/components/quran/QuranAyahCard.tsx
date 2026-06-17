import { Ionicons } from "@expo/vector-icons";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

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
  onDoubleTap?: () => void;
  onLongPress?: () => void;
};

const DOUBLE_TAP_INTERVAL_MS = 280;

function QuranAyahCard({
  ayah,
  isSurahStart,
  surahMeta,
  showArabic = true,
  showEnglish = true,
  showTransliteration = false,
  isBookmarked = false,
  onDoubleTap,
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
  const lastTapRef = useRef(0);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isDoubleTapFeedbackVisible, setIsDoubleTapFeedbackVisible] =
    useState(false);
  const holdScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(holdScale, {
      toValue: 0.965,
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

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  const handlePress = useCallback(() => {
    if (!onDoubleTap) {
      return;
    }
    const now = Date.now();
    if (now - lastTapRef.current <= DOUBLE_TAP_INTERVAL_MS) {
      lastTapRef.current = 0;
      setIsDoubleTapFeedbackVisible(true);
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
      feedbackTimeoutRef.current = setTimeout(() => {
        setIsDoubleTapFeedbackVisible(false);
      }, 140);
      onDoubleTap();
    } else {
      lastTapRef.current = now;
    }
  }, [onDoubleTap]);

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
          style={[
            styles.ayahBlock,
            isDoubleTapFeedbackVisible && onDoubleTap ? styles.ayahCardPressed : null,
          ]}
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onLongPress={onLongPress}
          delayLongPress={400}
          accessibilityRole="button"
          accessibilityLabel={`Ayah ${ayah.ayahNumber} from Surah ${ayah.surahNumber}`}
        >
          {isBookmarked ? (
            <View style={styles.bookmarkBadge}>
              <Ionicons name="bookmark" size={18} color={themeColors.danger} />
            </View>
          ) : null}
          {shouldShowArabic ? (
            <Text
              style={[
                styles.arabic,
                (shouldShowEnglish || shouldShowTransliteration) &&
                  styles.textBlockSpacing,
              ]}
              allowFontScaling={false}
              // @ts-expect-error includeFontPadding is available on React Native Text for Android layout
              includeFontPadding={false}
              textBreakStrategy="highQuality"
            >
              {ayah.arabicText}
              <Text
                style={styles.ayahMarker}
                testID="ayah-number-marker"
                allowFontScaling={false}
              >
                {` \u{FD3E}${ayah.ayahNumber}\u{FD3F}`}
              </Text>
            </Text>
          ) : null}
          {shouldShowTransliteration ? (
            <Text
              style={[
                styles.transliteration,
                shouldShowEnglish && styles.textBlockSpacing,
              ]}
            >
              {ayah.transliteration}
            </Text>
          ) : null}
          {shouldShowEnglish ? (
            <Text style={styles.translation}>{ayah.englishText}</Text>
          ) : null}
        </Pressable>
      </Animated.View>
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
      paddingHorizontal: theme.spacing.xs,
    },

    ayahCardPressed: {
      transform: [{ scale: 0.985 }],
      opacity: 0.95,
    },

    /* INLINE AYAH NUMBER MARKER */
    ayahMarker: {
      color: themeColors.accent,
      fontSize: 16,
      textAlign: "right",
      writingDirection: "rtl",
    },

    /* BOOKMARK BADGE */
    bookmarkBadge: {
      position: "absolute",
      top: 13,
      left: 13,
      backgroundColor: withOpacity(themeColors.black, 0.35),
      borderRadius: 999,
      padding: 6,
      borderWidth: 1,
      borderColor: withOpacity(themeColors.white, 0.08),
    },

    /* ARABIC */
    arabic: {
      fontSize: 31,
      textAlign: "right",
      writingDirection: "rtl",
      color: themeColors.white,
      lineHeight: 48,
      letterSpacing: 0.2,
    },

    textBlockSpacing: {
      marginBottom: 13,
    },

    /* TRANSLITERATION */
    transliteration: {
      fontSize: 14,
      color: themeColors.white,
      opacity: 0.75,
      lineHeight: 22,
      textAlign: "center",
      fontStyle: "italic",
    },

    /* TRANSLATION */
    translation: {
      fontSize: 15,
      color: themeColors.white,
      opacity: 0.9,
      lineHeight: 23,
      textAlign: "left",
    },
  });
};
