import { memo, useCallback, useMemo, useState } from "react";
import {
  FlatList,
  InteractionManager,
  ListRenderItem,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { NormalizedSurahMeta } from "@/services/quranData";

import PressableScale from "../../PressableScale";

type SurahTabProps = {
  surahs: readonly NormalizedSurahMeta[];
  filteredSurahs: readonly NormalizedSurahMeta[];
  ayahSearchResults: readonly QuranAyahSearchResult[];
  juzSearchResult: QuranJuzSearchResult | null;
  surahSearchQuery: string;
  onSurahSearchQueryChange: (value: string) => void;
  onSelectSurah: (surahNumber: number) => void;
  onSelectAyah: (surahNumber: number, ayahNumber: number) => void;
  onSelectJuz: (juzNumber: number) => void;
  onClose: () => void;
};

type SurahItem = NormalizedSurahMeta;
export type QuranAyahSearchResult = {
  surahNumber: number;
  ayahNumber: number;
  surahEnglishName: string;
  englishText: string;
};
export type QuranJuzSearchResult = {
  juzNumber: number;
};

function SurahTab({
  surahs,
  filteredSurahs,
  ayahSearchResults,
  juzSearchResult,
  surahSearchQuery,
  onSurahSearchQueryChange,
  onSelectSurah,
  onSelectAyah,
  onSelectJuz,
  onClose,
}: SurahTabProps) {
  const { theme } = useTheme();
  const themeColors = theme.colors;
  const isLight = theme.name === "light";
  const styles = useMemo(() => createStyles(theme), [theme]);

  const trimmedQuery = surahSearchQuery.trim();
  const [showJuzGrid, setShowJuzGrid] = useState(false);
  const data = useMemo(() => {
    return trimmedQuery ? filteredSurahs : surahs;
  }, [filteredSurahs, surahs, trimmedQuery]);

  const dataLength = data.length;
  const { width } = useWindowDimensions();
  const numColumns = width >= 640 ? 3 : 2;

  const handleSelect = useCallback(
    (surahNumber: number) => {
      onClose();
      InteractionManager.runAfterInteractions(() => {
        onSelectSurah(surahNumber);
      });
    },
    [onClose, onSelectSurah],
  );

  const handleSelectAyah = useCallback(
    (surahNumber: number, ayahNumber: number) => {
      onClose();
      InteractionManager.runAfterInteractions(() => {
        onSelectAyah(surahNumber, ayahNumber);
      });
    },
    [onClose, onSelectAyah],
  );

  const handleSelectJuz = useCallback(
    (juzNumber: number) => {
      onClose();
      InteractionManager.runAfterInteractions(() => {
        onSelectJuz(juzNumber);
      });
    },
    [onClose, onSelectJuz],
  );

  const renderItem = useCallback<ListRenderItem<SurahItem>>(
    ({ item, index }) => {
      const isEndOfRow = (index + 1) % numColumns === 0;
      const isLastItem = index === dataLength - 1;
      const itemStyle =
        isEndOfRow || isLastItem ? styles.surahTile : styles.surahTileSpaced;

      return (
        <PressableScale
          style={itemStyle}
          onPress={() => handleSelect(item.surahNumber)}
        >
          <View style={styles.surahTileRow}>
            <Text style={styles.surahEnglish}>{item.englishName}</Text>
            <Text style={styles.surahArabic}>{item.arabicName}</Text>
          </View>
          <Text style={styles.surahMeta}>
            Surah {item.surahNumber} • {item.ayahCount} ayat
          </Text>
        </PressableScale>
      );
    },
    [dataLength, handleSelect, numColumns, styles],
  );

  const keyExtractor = useCallback((item: SurahItem) => {
    return String(item.surahNumber);
  }, []);

  const showEmptyState =
    trimmedQuery.length > 0 &&
    data.length === 0 &&
    ayahSearchResults.length === 0 &&
    !juzSearchResult;

  const listHeaderComponent = (
    <View style={styles.headerContainer}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search verses or 2:255"
        placeholderTextColor={
          isLight
            ? withOpacity(themeColors.grayDark, 0.86)
            : withOpacity(themeColors.white, 0.5)
        }
        value={surahSearchQuery}
        onChangeText={onSurahSearchQueryChange}
      />
      {trimmedQuery.length > 0 && ayahSearchResults.length > 0 ? (
        <View style={styles.ayahResultsContainer}>
          <Text style={styles.sectionHeading}>Verse Matches</Text>
          {ayahSearchResults.map((result) => (
            <PressableScale
              key={`${result.surahNumber}:${result.ayahNumber}`}
              style={styles.ayahResultTile}
              onPress={() =>
                handleSelectAyah(result.surahNumber, result.ayahNumber)
              }
            >
              <Text style={styles.ayahResultMeta}>
                {result.surahEnglishName} {result.surahNumber}:
                {result.ayahNumber}
              </Text>
              <Text style={styles.ayahResultText} numberOfLines={2}>
                {result.englishText}
              </Text>
            </PressableScale>
          ))}
        </View>
      ) : null}
      {trimmedQuery.length > 0 && juzSearchResult ? (
        <View style={styles.ayahResultsContainer}>
          <Text style={styles.sectionHeading}>Juz Match</Text>
          <PressableScale
            style={styles.ayahResultTile}
            onPress={() => handleSelectJuz(juzSearchResult.juzNumber)}
          >
            <Text style={styles.ayahResultMeta}>
              Juz {juzSearchResult.juzNumber}
            </Text>
            <Text style={styles.ayahResultText} numberOfLines={1}>
              Jump directly to Juz {juzSearchResult.juzNumber}
            </Text>
          </PressableScale>
        </View>
      ) : null}
      {trimmedQuery.length === 0 ? (
        <View style={styles.juzSection}>
          <View style={styles.juzHeaderRow}>
            <Text style={styles.sectionHeading}>Juz Quick Jump</Text>
            <PressableScale
              style={[
                styles.juzToggle,
                showJuzGrid && styles.juzToggleActive,
              ]}
              onPress={() => setShowJuzGrid((value) => !value)}
            >
              <Text
                style={[
                  styles.juzToggleText,
                  showJuzGrid && styles.juzToggleTextActive,
                ]}
              >
                {showJuzGrid ? "Collapse" : "Expand"}
              </Text>
            </PressableScale>
          </View>
          {showJuzGrid ? (
            <>
              <View style={styles.juzGrid}>
                {Array.from({ length: 30 }, (_, index) => {
                  const juz = index + 1;
                  return (
                    <PressableScale
                      key={juz}
                      style={styles.juzTile}
                      onPress={() => handleSelectJuz(juz)}
                    >
                      <Text style={styles.juzTileText}>{juz}</Text>
                    </PressableScale>
                  );
                })}
              </View>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <FlatList
      data={data as readonly SurahItem[]}
      extraData={numColumns}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={numColumns}
      ListHeaderComponent={listHeaderComponent}
      ListEmptyComponent={
        showEmptyState
          ? () => (
              <Text style={styles.emptyStateText}>
                No matching verses or surahs.
              </Text>
            )
          : null
      }
      contentContainerStyle={styles.listContent}
      columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      keyboardDismissMode="none"
    />
  );
}

export default memo(SurahTab);

const createStyles = (theme: AppTheme) => {
  const themeColors = theme.colors;
  const isLight = theme.name === "light";

  return StyleSheet.create({
    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 18,
      paddingTop: 8,
    },
    columnWrapper: {
      paddingBottom: 12,
    },
    headerContainer: {
      marginBottom: 14,
    },
    sectionHeading: {
      color: isLight
        ? withOpacity(themeColors.grayDark, 0.95)
        : withOpacity(themeColors.white, 0.86),
      fontSize: 13,
      fontWeight: "600",
      marginTop: 12,
      marginBottom: 8,
      letterSpacing: 0.35,
      textTransform: "uppercase",
    },
    ayahResultsContainer: {
      marginBottom: 8,
    },
    ayahResultTile: {
      backgroundColor: isLight
        ? withOpacity(themeColors.primaryHighlight, 0.94)
        : withOpacity(themeColors.white, 0.08),
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderWidth: 1,
      borderColor: isLight
        ? withOpacity(themeColors.primaryBorder, 0.7)
        : withOpacity(themeColors.accent, 0.28),
      marginBottom: 9,
    },
    ayahResultMeta: {
      color: isLight ? themeColors.primaryOutline : themeColors.accent,
      fontSize: 12,
      fontWeight: "600",
      marginBottom: 4,
    },
    ayahResultText: {
      color: isLight
        ? withOpacity(themeColors.offWhite, 0.88)
        : withOpacity(themeColors.white, 0.84),
      fontSize: 13,
      lineHeight: 18,
    },
    juzSection: {
      marginTop: 10,
    },
    juzHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    juzToggle: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: isLight
        ? withOpacity(themeColors.primaryBorder, 0.66)
        : withOpacity(themeColors.white, 0.24),
      backgroundColor: isLight
        ? withOpacity(themeColors.primarySurface, 0.92)
        : withOpacity(themeColors.white, 0.08),
    },
    juzToggleActive: {
      borderColor: isLight
        ? withOpacity(themeColors.primaryOutline, 0.85)
        : withOpacity(themeColors.accent, 0.48),
      backgroundColor: isLight
        ? withOpacity(themeColors.accentSoft, 0.85)
        : withOpacity(themeColors.accent, 0.16),
    },
    juzToggleText: {
      color: isLight
        ? withOpacity(themeColors.grayDark, 0.96)
        : withOpacity(themeColors.white, 0.86),
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.3,
    },
    juzToggleTextActive: {
      color: isLight ? themeColors.offWhite : themeColors.accent,
    },
    juzGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      rowGap: 8,
      columnGap: 8,
    },
    juzTile: {
      flexBasis: "18%", // base width
      flexGrow: 1,
      width: "16.66%",
      marginBottom: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: isLight
        ? withOpacity(themeColors.primarySurface, 0.94)
        : withOpacity(themeColors.white, 0.08),
      borderRadius: 11,
      borderWidth: 1,
      borderColor: isLight
        ? withOpacity(themeColors.primaryBorder, 0.7)
        : withOpacity(themeColors.accent, 0.3),
      minHeight: 36,
    },
    juzTileText: {
      color: isLight ? themeColors.offWhite : themeColors.white,
      fontWeight: "600",
      fontSize: 13,
    },
    searchInput: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 15,
      backgroundColor: isLight
        ? withOpacity(themeColors.primarySurface, 0.95)
        : withOpacity(themeColors.white, 0.09),
      color: isLight ? themeColors.offWhite : themeColors.white,
      fontSize: 15,
      borderWidth: 1,
      borderColor: isLight
        ? withOpacity(themeColors.primaryBorder, 0.72)
        : withOpacity(themeColors.white, 0.16),
    },
    surahTile: {
      flex: 1,
      paddingVertical: 15,
      paddingHorizontal: 16,
      borderRadius: 15,
      backgroundColor: isLight
        ? withOpacity(themeColors.primaryHighlight, 0.94)
        : withOpacity(themeColors.white, 0.07),
      borderWidth: 1,
      borderColor: isLight
        ? withOpacity(themeColors.primaryBorder, 0.72)
        : withOpacity(themeColors.accent, 0.28),
      marginBottom: 12,
    },
    surahTileSpaced: {
      flex: 1,
      paddingVertical: 15,
      paddingHorizontal: 16,
      borderRadius: 15,
      backgroundColor: isLight
        ? withOpacity(themeColors.primaryHighlight, 0.94)
        : withOpacity(themeColors.white, 0.07),
      borderWidth: 1,
      borderColor: isLight
        ? withOpacity(themeColors.primaryBorder, 0.72)
        : withOpacity(themeColors.accent, 0.28),
      marginBottom: 12,
      marginRight: 12,
    },
    surahTileRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    surahEnglish: {
      color: isLight ? themeColors.offWhite : themeColors.white,
      fontSize: 16,
      fontWeight: "600",
      flexShrink: 1,
      marginRight: 12,
    },
    surahArabic: {
      color: isLight ? themeColors.primaryOutline : themeColors.accent,
      fontSize: 18,
    },
    surahMeta: {
      color: isLight
        ? withOpacity(themeColors.grayDark, 0.94)
        : withOpacity(themeColors.white, 0.66),
      fontSize: 12,
    },
    emptyStateText: {
      color: isLight
        ? withOpacity(themeColors.grayDark, 0.92)
        : withOpacity(themeColors.white, 0.7),
      textAlign: "center",
      fontSize: 14,
      paddingVertical: 12,
    },
  });
};
