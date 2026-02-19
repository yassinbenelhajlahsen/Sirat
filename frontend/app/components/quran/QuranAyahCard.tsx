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
    marginBottom: 28,
  },
  surahDividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  surahDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: withOpacity(themeColors.accent, 0.25),
  },
  surahDividerLabel: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: withOpacity(themeColors.accent, 0.35),
    backgroundColor: themeColors.primary,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 140,
  },
  surahDividerArabic: {
    color: themeColors.accent,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  surahDividerEnglish: {
    color: themeColors.white,
    fontSize: 12,
    opacity: 0.75,
    marginTop: 2,
    textAlign: "center",
  },
  ayahCard: {
    backgroundColor: themeColors.primarySurface,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  surahTag: {
    alignSelf: "flex-end",
    color: themeColors.accent,
    opacity: 0.75,
    fontSize: 12,
    marginBottom: 6,
  },
  bookmarkBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: withOpacity(themeColors.black, 0.25),
    borderRadius: 12,
    padding: 4,
  },
  ayahCardPressed: {
    opacity: 0.92,
  },
  arabic: {
    fontSize: 28,
    textAlign: "right",
    writingDirection: "rtl",
    color: themeColors.white,
    lineHeight: 42,
  },
  textBlockSpacing: {
    marginBottom: 12,
  },
  transliteration: {
    fontSize: 16,
    color: themeColors.white,
    opacity: 0.82,
    lineHeight: 24,
    textAlign: "center",
    fontStyle: "italic",
  },
  translation: {
    fontSize: 16,
    color: themeColors.white,
    opacity: 0.85,
    lineHeight: 22,
    textAlign: "left",
  },
});
