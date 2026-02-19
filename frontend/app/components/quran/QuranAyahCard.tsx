import { Ionicons } from "@expo/vector-icons";
import { memo, useCallback, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors as themeColors, withOpacity } from "@/constants/theme";
import { NormalizedAyah, NormalizedSurahMeta } from "@/services/quranData";

type QuranAyahCardProps = {
  ayah: NormalizedAyah;
  isSurahStart: boolean;
  surahMeta?: NormalizedSurahMeta;
  showArabic?: boolean;
  showEnglish?: boolean;
  showTransliteration?: boolean;
  isBookmarked?: boolean;
  onDoubleTap?: () => void;
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
}: QuranAyahCardProps) {
  const arabicName = surahMeta?.arabicName ?? ayah.surahNameAr;
  const englishName = surahMeta?.englishName ?? ayah.surahNameEn;
  const shouldShowArabic = showArabic && Boolean(ayah.arabicText);
  const shouldShowEnglish = showEnglish && Boolean(ayah.englishText);
  const shouldShowTransliteration =
    showTransliteration && Boolean(ayah.transliteration);
  const lastTapRef = useRef(0);

  const handlePress = useCallback(() => {
    if (!onDoubleTap) {
      return;
    }
    const now = Date.now();
    if (now - lastTapRef.current <= DOUBLE_TAP_INTERVAL_MS) {
      lastTapRef.current = 0;
      onDoubleTap();
    } else {
      lastTapRef.current = now;
    }
  }, [onDoubleTap]);

  return (
    <View style={styles.container}>
      {isSurahStart ? (
        <View style={styles.surahDividerRow}>
          <View style={styles.surahDividerLine} />
          <View style={styles.surahDividerLabel}>
            <Text style={styles.surahDividerArabic}>{arabicName}</Text>
            {englishName ? (
              <Text style={styles.surahDividerEnglish}>{englishName}</Text>
            ) : null}
          </View>
          <View style={styles.surahDividerLine} />
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.ayahCard,
          pressed && onDoubleTap ? styles.ayahCardPressed : null,
        ]}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`Ayah ${ayah.ayahNumber} from Surah ${ayah.surahNumber}`}
      >
        {isBookmarked ? (
          <View style={styles.bookmarkBadge}>
            <Ionicons name="bookmark" size={18} color={themeColors.danger} />
          </View>
        ) : null}
        <Text style={styles.surahTag}>
          {ayah.surahNumber}:{ayah.ayahNumber}
        </Text>
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
    </View>
  );
}

export default memo(QuranAyahCard);

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },

  /* SURAH DIVIDER */
  surahDividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  surahDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: withOpacity(themeColors.accent, 0.18),
  },
  surahDividerLabel: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: withOpacity(themeColors.accent, 0.28),
    backgroundColor: withOpacity(themeColors.primarySurface, 0.85),
    alignItems: "center",
    justifyContent: "center",
    minWidth: 150,
  },
  surahDividerArabic: {
    color: themeColors.accent,
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  surahDividerEnglish: {
    color: themeColors.white,
    fontSize: 12,
    opacity: 0.65,
    marginTop: 2,
    textAlign: "center",
  },

  /* AYAH CARD */
  ayahCard: {
    backgroundColor: themeColors.primarySurface,
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 18,

    borderWidth: 1,
    borderColor: withOpacity(themeColors.white, 0.06),

    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },

  ayahCardPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.95,
  },

  /* TOP RIGHT AYAH NUMBER */
  surahTag: {
    alignSelf: "flex-end",
    color: themeColors.accent,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: withOpacity(themeColors.accent, 0.08),
  },

  /* BOOKMARK BADGE */
  bookmarkBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: withOpacity(themeColors.black, 0.35),
    borderRadius: 999,
    padding: 6,
    borderWidth: 1,
    borderColor: withOpacity(themeColors.white, 0.08),
  },

  /* ARABIC */
  arabic: {
    fontSize: 30,
    textAlign: "right",
    writingDirection: "rtl",
    color: themeColors.white,
    lineHeight: 46,
    letterSpacing: 0.2,
  },

  textBlockSpacing: {
    marginBottom: 14,
  },

  /* TRANSLITERATION */
  transliteration: {
    fontSize: 15,
    color: themeColors.white,
    opacity: 0.75,
    lineHeight: 23,
    textAlign: "center",
    fontStyle: "italic",
  },

  /* TRANSLATION */
  translation: {
    fontSize: 16,
    color: themeColors.white,
    opacity: 0.88,
    lineHeight: 24,
    textAlign: "left",
  },
});
