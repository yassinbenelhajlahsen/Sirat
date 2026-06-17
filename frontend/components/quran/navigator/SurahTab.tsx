import { BottomSheetFlatList, BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { memo, useCallback, useMemo } from "react";
import {
  InteractionManager,
  ListRenderItem,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { radii, withOpacity, type AppTheme } from "@/constants/theme";
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
            <Text style={styles.surahNumber}>{item.surahNumber}</Text>
            <Text style={styles.surahArabic}>{item.arabicName}</Text>
          </View>
          <Text style={styles.surahEnglish}>{item.englishName}</Text>
          <Text style={styles.surahMeta}>
            {item.ayahCount} ayāt
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
      <BottomSheetTextInput
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
    </View>
  );

  return (
    <BottomSheetFlatList
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
      style={styles.list}
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
  const mat = theme.materials.row;

  return StyleSheet.create({
    list: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 32,
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
      backgroundColor: mat.fill,
      borderRadius: radii.row,
      borderCurve: "continuous",
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderWidth: 1,
      borderColor: mat.border,
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
      paddingVertical: 13,
      paddingHorizontal: 14,
      borderRadius: radii.row,
      borderCurve: "continuous",
      backgroundColor: withOpacity(themeColors.white, 0.05),
      borderWidth: 1,
      borderColor: withOpacity(themeColors.white, 0.1),
      marginBottom: 12,
    },
    surahTileSpaced: {
      flex: 1,
      paddingVertical: 13,
      paddingHorizontal: 14,
      borderRadius: radii.row,
      borderCurve: "continuous",
      backgroundColor: withOpacity(themeColors.white, 0.05),
      borderWidth: 1,
      borderColor: withOpacity(themeColors.white, 0.1),
      marginBottom: 12,
      marginRight: 12,
    },
    surahTileRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    surahNumber: {
      color: themeColors.accent,
      fontSize: 13,
      fontWeight: "700",
    },
    surahEnglish: {
      color: isLight ? themeColors.offWhite : themeColors.white,
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 3,
    },
    surahArabic: {
      color: themeColors.accent,
      fontSize: 17,
    },
    surahMeta: {
      color: isLight
        ? withOpacity(themeColors.grayDark, 0.94)
        : withOpacity(themeColors.white, 0.55),
      fontSize: 11,
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
