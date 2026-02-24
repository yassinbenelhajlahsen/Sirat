import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import useModalTransition from "@/hooks/useModalTransition";
import { QuranBookmark } from "@/services/quranBookmarks";
import { NormalizedSurahMeta } from "@/services/quranData";

import PressableScale from "../../PressableScale";
import BookmarksTab, { BookmarkNavigatorItem } from "./BookmarksTab";
import NavigatorTabs, { NavigatorTabKey } from "./NavigatorTabs";
import SurahTab, {
  QuranAyahSearchResult,
  QuranJuzSearchResult,
} from "./SurahTab";

type QuranNavigatorModalProps = {
  visible: boolean;
  initialTab?: NavigatorTabKey;
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

function NavigatorModal({
  visible,
  initialTab = "goto",
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

  const [selectedTab, setSelectedTab] = useState<NavigatorTabKey>("goto");
  const { shouldRender, overlayAnimatedStyle, cardAnimatedStyle } =
    useModalTransition(visible);

  const previousVisibleRef = useRef(visible);

  useEffect(() => {
    if (visible && !previousVisibleRef.current) {
      setSelectedTab(initialTab);
    }
    previousVisibleRef.current = visible;
  }, [initialTab, visible]);

  const handleSelectTab = useCallback((tab: NavigatorTabKey) => {
    setSelectedTab(tab);
  }, []);

  if (!shouldRender) {
    return null;
  }

  return (
    <Modal
      animationType="none"
      transparent
      visible={shouldRender}
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <Animated.View style={[styles.modalOverlay, overlayAnimatedStyle]}>
          <Animated.View style={[styles.modalCard, cardAnimatedStyle]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Navigation</Text>
                <Text style={styles.modalSubtitle}>
                  Jump by surah, ayah, juz, or bookmark
                </Text>
              </View>
              <PressableScale
                accessibilityRole="button"
                onPress={onClose}
                style={styles.dismissButton}
                scaleTo={0.85}
              >
                <View style={styles.dismissIcon}>
                  <View style={[styles.dismissLine, styles.dismissLineFirst]} />
                  <View
                    style={[styles.dismissLine, styles.dismissLineSecond]}
                  />
                </View>
              </PressableScale>
            </View>

            <NavigatorTabs
              selectedTab={selectedTab}
              onSelectTab={handleSelectTab}
            />

            <View style={styles.tabContentContainer}>
              <View
                style={[
                  styles.tabPanel,
                  selectedTab === "bookmarks"
                    ? styles.tabPanelActive
                    : styles.tabPanelInactive,
                ]}
                pointerEvents={selectedTab === "bookmarks" ? "auto" : "none"}
              >
                <BookmarksTab
                  bookmarks={bookmarks}
                  filteredBookmarks={filteredBookmarks}
                  bookmarkSearchQuery={bookmarkSearchQuery}
                  onBookmarkSearchQueryChange={onBookmarkSearchQueryChange}
                  onSelectBookmark={onSelectBookmark}
                  onDeleteBookmark={onDeleteBookmark}
                  onClose={onClose}
                />
              </View>

              <View
                style={[
                  styles.tabPanel,
                  selectedTab === "goto"
                    ? styles.tabPanelActive
                    : styles.tabPanelInactive,
                ]}
                pointerEvents={selectedTab === "goto" ? "auto" : "none"}
              >
                <SurahTab
                  surahs={surahs}
                  filteredSurahs={filteredSurahs}
                  ayahSearchResults={ayahSearchResults}
                  juzSearchResult={juzSearchResult}
                  surahSearchQuery={surahSearchQuery}
                  onSurahSearchQueryChange={onSurahSearchQueryChange}
                  onSelectSurah={onSelectSurah}
                  onSelectAyah={onSelectAyah}
                  onSelectJuz={onSelectJuz}
                  onClose={onClose}
                />
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

export default memo(NavigatorModal);
export type { BookmarkNavigatorItem, QuranNavigatorModalProps };

const createStyles = (theme: AppTheme) => {
  const themeColors = theme.colors;
  const isLight = theme.name === "light";

  return StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: isLight
        ? withOpacity(themeColors.black, 0.32)
        : withOpacity(themeColors.black, 0.62),
      justifyContent: "center",
      padding: 18,
    },
    modalCard: {
      backgroundColor: isLight
        ? withOpacity(themeColors.primaryLift, 0.98)
        : withOpacity(themeColors.primaryDeep, 0.97),
      borderRadius: 24,
      paddingBottom: 12,
      minHeight: 680,
      maxHeight: "74%",
      borderWidth: 1,
      borderColor: isLight
        ? withOpacity(themeColors.primaryBorder, 0.75)
        : withOpacity(themeColors.accent, 0.38),
      shadowColor: themeColors.black,
      shadowOpacity: 0.3,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 10 },
      elevation: 16,
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
    tabPanel: {
      flex: 1,
    },
    tabPanelActive: {
      position: "relative",
      opacity: 1,
    },
    tabPanelInactive: {
      display: "none",
    },
  });
};
