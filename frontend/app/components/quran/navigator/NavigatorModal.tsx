import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { colors as themeColors, withOpacity } from "@/constants/theme";
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
  const [selectedTab, setSelectedTab] = useState<NavigatorTabKey>("goto");

  const [shouldRender, setShouldRender] = useState(visible);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(28)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  const previousVisibleRef = useRef(visible);

  useEffect(() => {
    overlayOpacity.stopAnimation();
    cardTranslateY.stopAnimation();
    cardOpacity.stopAnimation();

    if (visible) {
      setShouldRender(true);
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cardTranslateY, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 160,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cardTranslateY, {
          toValue: 28,
          duration: 220,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 0,
          duration: 160,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setShouldRender(false);
        }
      });
    }
  }, [cardOpacity, cardTranslateY, overlayOpacity, visible]);

  useEffect(() => {
    if (visible && !previousVisibleRef.current) {
      setSelectedTab("goto");
    }
    previousVisibleRef.current = visible;
  }, [visible]);

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
        <Animated.View
          style={[styles.modalOverlay, { opacity: overlayOpacity }]}
        >
          <Animated.View
            style={[
              styles.modalCard,
              {
                opacity: cardOpacity,
                transform: [{ translateY: cardTranslateY }],
              },
            ]}
          >
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

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: withOpacity(themeColors.black, 0.62),
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    backgroundColor: withOpacity(themeColors.primaryDeep, 0.97),
    borderRadius: 24,
    paddingBottom: 12,
    minHeight: 680,
    maxHeight: "74%",
    borderWidth: 1,
    borderColor: withOpacity(themeColors.accent, 0.38),
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
    color: themeColors.white,
  },
  modalSubtitle: {
    marginTop: 4,
    color: withOpacity(themeColors.white, 0.66),
    fontSize: 12,
    letterSpacing: 0.3,
  },
  dismissButton: {
    padding: 8,
    marginTop: -2,
    borderRadius: 999,
    backgroundColor: withOpacity(themeColors.white, 0.08),
    borderWidth: 1,
    borderColor: withOpacity(themeColors.white, 0.12),
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
    backgroundColor: themeColors.white,
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
