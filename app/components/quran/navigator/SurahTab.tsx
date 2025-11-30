import { memo, useCallback, useMemo } from "react";
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

import { colors as themeColors, withOpacity } from "@/constants/theme";
import { NormalizedSurahMeta } from "@/services/quranData";

import PressableScale from "../../PressableScale";

type SurahTabProps = {
  surahs: readonly NormalizedSurahMeta[];
  filteredSurahs: readonly NormalizedSurahMeta[];
  surahSearchQuery: string;
  onSurahSearchQueryChange: (value: string) => void;
  onSelectSurah: (surahNumber: number) => void;
  onClose: () => void;
};

type SurahItem = NormalizedSurahMeta;

function SurahTab({
  surahs,
  filteredSurahs,
  surahSearchQuery,
  onSurahSearchQueryChange,
  onSelectSurah,
  onClose,
}: SurahTabProps) {
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
    [onClose, onSelectSurah]
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
    [dataLength, handleSelect, numColumns]
  );

  const keyExtractor = useCallback((item: SurahItem) => {
    return String(item.surahNumber);
  }, []);

  const showEmptyState = trimmedQuery.length > 0 && data.length === 0;

  const listHeaderComponent = (
    <View style={styles.headerContainer}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search surah..."
        placeholderTextColor={withOpacity(themeColors.white, 0.5)}
        value={surahSearchQuery}
        onChangeText={onSurahSearchQueryChange}
      />
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
          ? () => <Text style={styles.emptyStateText}>No surah found.</Text>
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

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 8,
  },
  columnWrapper: {
    paddingBottom: 12,
  },
  headerContainer: {
    marginBottom: 12,
  },
  sectionHeading: {
    color: themeColors.white,
    fontSize: 16,
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 8,
  },
  searchInput: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: withOpacity(themeColors.white, 0.1),
    color: themeColors.white,
    fontSize: 15,
  },
  surahTile: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: themeColors.primarySurface,
    borderWidth: 1,
    borderColor: withOpacity(themeColors.accent, 0.5),
    marginBottom: 12,
  },
  surahTileSpaced: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: themeColors.primarySurface,
    borderWidth: 1,
    borderColor: withOpacity(themeColors.accent, 0.5),
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
    color: themeColors.white,
    fontSize: 16,
    fontWeight: "600",
    flexShrink: 1,
    marginRight: 12,
  },
  surahArabic: {
    color: themeColors.accent,
    fontSize: 18,
  },
  surahMeta: {
    color: withOpacity(themeColors.white, 0.6),
    fontSize: 12,
  },
  emptyStateText: {
    color: withOpacity(themeColors.white, 0.7),
    textAlign: "center",
    fontSize: 14,
    paddingVertical: 12,
  },
});
