import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import NativeSheet from "@/components/ui/NativeSheet";
import { Footnote } from "@/components/ui/Text";
import { type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { QuranBookmark } from "@/services/quranBookmarks";
import { NormalizedSurahMeta } from "@/services/quranData";

import BookmarksTab, { BookmarkNavigatorItem } from "./BookmarksTab";
import JuzTab from "./JuzTab";
import NavigatorTabs, { NavigatorTabKey } from "./NavigatorTabs";
import SurahTab, {
  QuranAyahSearchResult,
  QuranJuzSearchResult,
} from "./SurahTab";

type LastReadAyah = {
  surahNumber: number;
  ayahNumber: number;
  englishName: string;
  arabicName: string;
};

type QuranNavigatorModalProps = {
  visible: boolean;
  initialTab?: NavigatorTabKey;
  lastRead?: LastReadAyah | null;
  surahs: readonly NormalizedSurahMeta[];
  filteredSurahs: readonly NormalizedSurahMeta[];
  ayahSearchResults: readonly QuranAyahSearchResult[];
  juzSearchResult: QuranJuzSearchResult | null;
  surahSearchQuery: string;
  bookmarks: readonly BookmarkNavigatorItem[];
  filteredBookmarks: readonly BookmarkNavigatorItem[];
  bookmarkSearchQuery: string;
  onSurahSearchQueryChange: (value: string) => void;
  onBookmarkSearchQueryChange: (value: string) => void;
  onSelectSurah: (surahNumber: number) => void;
  onSelectAyah: (surahNumber: number, ayahNumber: number) => void;
  onSelectJuz: (juzNumber: number) => void;
  onSelectBookmark: (bookmark: QuranBookmark) => void;
  onDeleteBookmark: (bookmark: QuranBookmark) => void;
  onClose: () => void;
};

const DETENTS = [0.78];

function NavigatorModal({
  visible,
  initialTab = "surah",
  lastRead,
  surahs,
  filteredSurahs,
  ayahSearchResults,
  juzSearchResult,
  surahSearchQuery,
  bookmarks,
  filteredBookmarks,
  bookmarkSearchQuery,
  onSurahSearchQueryChange,
  onBookmarkSearchQueryChange,
  onSelectSurah,
  onSelectAyah,
  onSelectJuz,
  onSelectBookmark,
  onDeleteBookmark,
  onClose,
}: QuranNavigatorModalProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  // The native sheet covers the tab bar, so only the home indicator needs clearing.
  const bottomInset = useSafeAreaInsets().bottom;

  const [selectedTab, setSelectedTab] = useState<NavigatorTabKey>("surah");
  useEffect(() => {
    if (visible) setSelectedTab(initialTab);
  }, [initialTab, visible]);

  const handleSelectTab = useCallback((tab: NavigatorTabKey) => {
    setSelectedTab(tab);
  }, []);

  return (
    <NativeSheet visible={visible} onClose={onClose} title="Search" detents={DETENTS}>
      <View style={styles.content}>
        <Footnote color={theme.colors.textSecondary} style={styles.hint}>
          Find a surah, ayah, juz, or bookmark
        </Footnote>

        <NavigatorTabs selectedTab={selectedTab} onSelectTab={handleSelectTab} />

        <View style={styles.tabContentContainer}>
          {selectedTab === "surah" ? (
            <SurahTab
              surahs={surahs}
              filteredSurahs={filteredSurahs}
              ayahSearchResults={ayahSearchResults}
              juzSearchResult={juzSearchResult}
              surahSearchQuery={surahSearchQuery}
              lastRead={lastRead}
              bottomInset={bottomInset}
              onSurahSearchQueryChange={onSurahSearchQueryChange}
              onSelectSurah={onSelectSurah}
              onSelectAyah={onSelectAyah}
              onSelectJuz={onSelectJuz}
              onClose={onClose}
            />
          ) : selectedTab === "juz" ? (
            <JuzTab
              onSelectJuz={onSelectJuz}
              onClose={onClose}
              bottomInset={bottomInset}
            />
          ) : (
            <BookmarksTab
              bookmarks={bookmarks}
              filteredBookmarks={filteredBookmarks}
              bookmarkSearchQuery={bookmarkSearchQuery}
              bottomInset={bottomInset}
              onBookmarkSearchQueryChange={onBookmarkSearchQueryChange}
              onSelectBookmark={onSelectBookmark}
              onDeleteBookmark={onDeleteBookmark}
              onClose={onClose}
            />
          )}
        </View>
      </View>
    </NativeSheet>
  );
}

export default memo(NavigatorModal);
export type { BookmarkNavigatorItem, QuranNavigatorModalProps };

const createStyles = (_theme: AppTheme) => {
  return StyleSheet.create({
    content: {
      flex: 1,
      paddingBottom: 12,
    },
    hint: {
      paddingHorizontal: 20,
      marginBottom: 8,
    },
    tabContentContainer: {
      flex: 1,
      minHeight: 0,
      paddingTop: 2,
    },
  });
};
