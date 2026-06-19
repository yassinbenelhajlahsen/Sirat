import { BottomSheetFlatList, BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  InteractionManager,
  ListRenderItem,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native";

import { radii, withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { NormalizedSurahMeta } from "@/services/quranData";

import PressableScale from "../../PressableScale";

type LastReadAyah = {
  surahNumber: number;
  ayahNumber: number;
  englishName: string;
  arabicName: string;
};

type SurahTabProps = {
  surahs: readonly NormalizedSurahMeta[];
  filteredSurahs: readonly NormalizedSurahMeta[];
  ayahSearchResults: readonly QuranAyahSearchResult[];
  juzSearchResult: QuranJuzSearchResult | null;
  surahSearchQuery: string;
  lastRead?: LastReadAyah | null;
  bottomInset?: number;
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

// Surahs people most often jump to. Kept short so the default (no-search) view
// renders a handful of tiles instead of all 114; the full list is one tap away.
const POPULAR_SURAH_NUMBERS = [1, 2, 18, 36, 55, 56, 67, 112] as const;
const EMPTY_SURAHS: readonly SurahItem[] = [];

function SurahTab({
  surahs,
  filteredSurahs,
  ayahSearchResults,
  juzSearchResult,
  surahSearchQuery,
  lastRead,
  bottomInset = 0,
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
  const hasQuery = trimmedQuery.length > 0;

  // Search-forward: the default view shows Continue reading + Popular only; the
  // full 114 render only after the user taps "All Sūrahs". Reset when a search
  // starts so clearing it returns to the compact default.
  const [showAllSurahs, setShowAllSurahs] = useState(false);
  useEffect(() => {
    if (hasQuery) setShowAllSurahs(false);
  }, [hasQuery]);

  const data = useMemo(() => {
    if (hasQuery) return filteredSurahs;
    if (showAllSurahs) return surahs;
    return EMPTY_SURAHS;
  }, [hasQuery, showAllSurahs, filteredSurahs, surahs]);

  const dataLength = data.length;
  const { width } = useWindowDimensions();
  const numColumns = width >= 640 ? 3 : 2;

  const popularSurahs = useMemo(() => {
    const byNumber = new Map(surahs.map((s) => [s.surahNumber, s]));
    return POPULAR_SURAH_NUMBERS.map((n) => byNumber.get(n)).filter(
      (s): s is SurahItem => s != null,
    );
  }, [surahs]);

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

  // Shared tile markup for both the virtualized list and the Popular grid.
  const renderTile = useCallback(
    (item: SurahItem, style: StyleProp<ViewStyle>, onPress: () => void) => (
      <PressableScale key={item.surahNumber} style={style} onPress={onPress}>
        <View style={styles.surahTileRow}>
          <Text style={styles.surahNumber}>{item.surahNumber}</Text>
          <Text style={styles.surahArabic}>{item.arabicName}</Text>
        </View>
        <Text style={styles.surahEnglish}>{item.englishName}</Text>
        <Text style={styles.surahMeta}>{item.ayahCount} ayāt</Text>
      </PressableScale>
    ),
    [styles],
  );

  const renderItem = useCallback<ListRenderItem<SurahItem>>(
    ({ item, index }) => {
      const isEndOfRow = (index + 1) % numColumns === 0;
      const isLastItem = index === dataLength - 1;
      const itemStyle =
        isEndOfRow || isLastItem ? styles.surahTile : styles.surahTileSpaced;
      return renderTile(item, itemStyle, () => handleSelect(item.surahNumber));
    },
    [dataLength, handleSelect, numColumns, renderTile, styles],
  );

  const keyExtractor = useCallback((item: SurahItem) => {
    return String(item.surahNumber);
  }, []);

  const popularRows = useMemo(() => {
    const rows: SurahItem[][] = [];
    for (let i = 0; i < popularSurahs.length; i += numColumns) {
      rows.push(popularSurahs.slice(i, i + numColumns));
    }
    return rows;
  }, [popularSurahs, numColumns]);

  const showEmptyState =
    hasQuery &&
    data.length === 0 &&
    ayahSearchResults.length === 0 &&
    !juzSearchResult;

  const hasSearchResults =
    hasQuery && (ayahSearchResults.length > 0 || juzSearchResult !== null);

  const searchResultsHeader = hasSearchResults ? (
    <View style={styles.headerContainer}>
      {ayahSearchResults.length > 0 ? (
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
      {juzSearchResult ? (
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
  ) : null;

  const defaultHeader = (
    <View style={styles.defaultHeader}>
      {lastRead ? (
        <PressableScale
          style={styles.continueCard}
          accessibilityRole="button"
          onPress={() =>
            handleSelectAyah(lastRead.surahNumber, lastRead.ayahNumber)
          }
        >
          <Text style={styles.continueLabel}>Continue reading</Text>
          <View style={styles.continueTitleRow}>
            <Text style={styles.continueTitle}>{lastRead.englishName}</Text>
            <Text style={styles.continueArabic}>{lastRead.arabicName}</Text>
          </View>
          <Text style={styles.continueMeta}>Ayah {lastRead.ayahNumber}</Text>
        </PressableScale>
      ) : null}

      <Text style={styles.sectionHeading}>Popular</Text>
      {popularRows.map((row, rowIndex) => (
        <View key={`popular-row-${rowIndex}`} style={styles.popularRow}>
          {row.map((item, i) =>
            renderTile(
              item,
              i === row.length - 1 ? styles.surahTile : styles.surahTileSpaced,
              () => handleSelect(item.surahNumber),
            ),
          )}
        </View>
      ))}

      {showAllSurahs ? (
        <Text style={[styles.sectionHeading, styles.allHeading]}>
          All Sūrahs
        </Text>
      ) : (
        <PressableScale
          style={styles.allButton}
          accessibilityRole="button"
          onPress={() => setShowAllSurahs(true)}
        >
          <Text style={styles.allButtonText}>All Sūrahs</Text>
          <Text style={styles.allButtonChevron}>›</Text>
        </PressableScale>
      )}
    </View>
  );

  const listHeaderComponent = hasQuery ? searchResultsHeader : defaultHeader;

  const stickySearch = (
    <View style={styles.searchContainer}>
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
    </View>
  );

  return (
    <View style={styles.container}>
      {stickySearch}
      <BottomSheetFlatList
        data={data as readonly SurahItem[]}
        extraData={numColumns}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={numColumns}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
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
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: bottomInset + 32 },
        ]}
        columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
      />
    </View>
  );
}

export default memo(SurahTab);

const createStyles = (theme: AppTheme) => {
  const themeColors = theme.colors;
  const isLight = theme.name === "light";
  const mat = theme.materials.row;

  return StyleSheet.create({
    container: {
      flex: 1,
    },
    searchContainer: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 10,
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 32,
      paddingTop: 4,
    },
    columnWrapper: {
      paddingBottom: 12,
    },
    defaultHeader: {
      paddingTop: 4,
    },
    continueCard: {
      borderRadius: radii.row,
      borderCurve: "continuous",
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: withOpacity(themeColors.accent, isLight ? 0.16 : 0.14),
      borderWidth: 1,
      borderColor: withOpacity(themeColors.accent, isLight ? 0.4 : 0.35),
      marginBottom: 16,
    },
    continueLabel: {
      color: isLight ? themeColors.primaryOutline : themeColors.accent,
      fontSize: 12,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginBottom: 4,
    },
    continueTitleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    continueTitle: {
      color: isLight ? themeColors.offWhite : themeColors.white,
      fontSize: 16,
      fontWeight: "700",
    },
    continueArabic: {
      color: themeColors.accent,
      fontSize: 17,
    },
    continueMeta: {
      color: isLight
        ? withOpacity(themeColors.grayDark, 0.94)
        : withOpacity(themeColors.white, 0.6),
      fontSize: 12,
      marginTop: 2,
    },
    popularRow: {
      flexDirection: "row",
    },
    allHeading: {
      marginTop: 4,
    },
    allButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 13,
      borderRadius: radii.row,
      borderCurve: "continuous",
      backgroundColor: withOpacity(themeColors.white, 0.05),
      borderWidth: 1,
      borderColor: withOpacity(themeColors.accent, 0.3),
      marginTop: 2,
    },
    allButtonText: {
      color: isLight ? themeColors.offWhite : themeColors.white,
      fontSize: 14,
      fontWeight: "600",
    },
    allButtonChevron: {
      color: themeColors.accent,
      fontSize: 18,
      marginLeft: 6,
      marginTop: -2,
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
