import BottomSheet from "@gorhom/bottom-sheet";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaFrame, useSafeAreaInsets } from "react-native-safe-area-context";

import SheetBackground from "@/components/ui/SheetBackground";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { QuranBookmark } from "@/services/quranBookmarks";
import { NormalizedSurahMeta } from "@/services/quranData";

import PressableScale from "../../PressableScale";
import BookmarksTab, { BookmarkNavigatorItem } from "./BookmarksTab";
import JuzTab from "./JuzTab";
import NavigatorTabs, { NavigatorTabKey } from "./NavigatorTabs";
import SurahTab, {
  QuranAyahSearchResult,
  QuranJuzSearchResult,
} from "./SurahTab";

// Stable module-level backgroundComponent — avoids recreating on each render.
function NavigatorSheetBackground(p: Parameters<typeof SheetBackground>[0]) {
  return <SheetBackground {...p} solid />;
}

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

const SNAP_POINTS = ["78%"];

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
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();

  // gorhom 5.2 + reanimated 4 fails to bound this sheet's content to the snap
  // height, so the content View (flex:1) grows to its children and the
  // BottomSheetFlatList lays out at full content height with no scroll
  // viewport — the last rows fall off-screen. Cap the content host to the snap
  // height (computed from the real, correct window frame) so the list is
  // bounded and scrolls normally. Matches SNAP_POINTS ("78%").
  const contentMaxHeight = Math.round(frame.height * 0.78);

  // The sheet runs full-height to the screen bottom (one continuous surface,
  // like the display-settings sheet — no separate chrome strip to desync on
  // close). Pad each tab's scroll content past the floating glass tab bar so
  // the last rows aren't trapped behind the pill. Mirrors GlassTabBar's layout:
  // bottom offset + pill height + gap.
  const tabBarClearance = Math.max(insets.bottom, 14) + 6 + 64 + 8;

  const [selectedTab, setSelectedTab] = useState<NavigatorTabKey>("surah");
  // Stays mounted through the close animation; only unmounts once the sheet
  // reports it has fully closed (onChange === -1), so closing animates instead
  // of snapping shut.
  const [mounted, setMounted] = useState(visible);
  const sheetRef = useRef<BottomSheet>(null);
  const previousVisibleRef = useRef(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
    }
  }, [visible]);

  useEffect(() => {
    if (visible && !previousVisibleRef.current) {
      setSelectedTab(initialTab);
      sheetRef.current?.snapToIndex(0);
    } else if (!visible && previousVisibleRef.current) {
      sheetRef.current?.close();
    }
    previousVisibleRef.current = visible;
  }, [initialTab, visible]);

  const handleSelectTab = useCallback((tab: NavigatorTabKey) => {
    setSelectedTab(tab);
  }, []);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) {
        setMounted(false);
        onClose();
      }
    },
    [onClose],
  );

  const handleIndicatorStyle = useMemo(
    () => ({
      backgroundColor: withOpacity(theme.colors.white, 0.3),
      width: 38,
    }),
    [theme.colors.white],
  );

  if (!mounted) {
    return null;
  }

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={SNAP_POINTS}
      enableDynamicSizing={false}
      enablePanDownToClose
      backgroundComponent={NavigatorSheetBackground}
      handleIndicatorStyle={handleIndicatorStyle}
      onChange={handleSheetChange}
    >
      <View style={[styles.content, { maxHeight: contentMaxHeight }]}>
        <View style={styles.modalHeader}>
          <View>
            <Text style={styles.modalTitle}>Navigation</Text>
            <Text style={styles.modalSubtitle}>
              Jump by surah, ayah, juz, or bookmark
            </Text>
          </View>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={styles.dismissButton}
            scaleTo={0.85}
          >
            <View style={styles.dismissIcon}>
              <View style={[styles.dismissLine, styles.dismissLineFirst]} />
              <View style={[styles.dismissLine, styles.dismissLineSecond]} />
            </View>
          </PressableScale>
        </View>

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
              bottomInset={tabBarClearance}
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
              bottomInset={tabBarClearance}
            />
          ) : (
            <BookmarksTab
              bookmarks={bookmarks}
              filteredBookmarks={filteredBookmarks}
              bookmarkSearchQuery={bookmarkSearchQuery}
              bottomInset={tabBarClearance}
              onBookmarkSearchQueryChange={onBookmarkSearchQueryChange}
              onSelectBookmark={onSelectBookmark}
              onDeleteBookmark={onDeleteBookmark}
              onClose={onClose}
            />
          )}
        </View>
      </View>
    </BottomSheet>
  );
}

export default memo(NavigatorModal);
export type { BookmarkNavigatorItem, QuranNavigatorModalProps };

const createStyles = (theme: AppTheme) => {
  const themeColors = theme.colors;
  const isLight = theme.name === "light";

  return StyleSheet.create({
    content: {
      flex: 1,
      paddingBottom: 12,
    },
    modalHeader: {
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 10,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: isLight ? themeColors.offWhite : themeColors.white,
    },
    modalSubtitle: {
      marginTop: 4,
      color: isLight
        ? withOpacity(themeColors.grayDark, 0.95)
        : withOpacity(themeColors.white, 0.66),
      fontSize: 12,
      letterSpacing: 0.3,
    },
    dismissButton: {
      padding: 8,
      marginTop: -2,
      borderRadius: 999,
      backgroundColor: isLight
        ? withOpacity(themeColors.primarySurfaceAlt, 0.55)
        : withOpacity(themeColors.white, 0.08),
      borderWidth: 1,
      borderColor: isLight
        ? withOpacity(themeColors.primaryBorder, 0.7)
        : withOpacity(themeColors.white, 0.12),
    },
    dismissIcon: {
      width: 18,
      height: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    dismissLine: {
      position: "absolute",
      width: 18,
      height: 2,
      backgroundColor: isLight ? themeColors.offWhite : themeColors.white,
      borderRadius: 999,
    },
    dismissLineFirst: {
      transform: [{ rotate: "45deg" }],
    },
    dismissLineSecond: {
      transform: [{ rotate: "-45deg" }],
    },
    tabContentContainer: {
      flex: 1,
      minHeight: 0,
      paddingTop: 2,
    },
  });
};
