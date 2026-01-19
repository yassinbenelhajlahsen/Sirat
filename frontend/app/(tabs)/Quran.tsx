import { colors as themeColors, withOpacity } from "@/constants/theme";
import { useQuranAudioController } from "@/context/QuranAudioProvider";
import {
  QuranBookmark,
  deleteBookmark,
  getBookmarkKey,
  getBookmarks,
  upsertBookmark,
} from "@/services/quranBookmarks";
import {
  NormalizedAyah,
  NormalizedSurahMeta,
  getAllAyat,
  getAyatIndexForSurahAndAyah,
  getSurahMeta,
} from "@/services/quranData";
import {
  getLastReadAyahIndex,
  saveLastReadAyahIndex,
  saveLastReadSurahAndAyah,
} from "@/services/quranProgress";
import { Ionicons } from "@expo/vector-icons";
import {
  FlashList,
  FlashListRef,
  ListRenderItem,
  ListRenderItemInfo,
} from "@shopify/flash-list";
import { setIsAudioActiveAsync } from "expo-audio";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  AppStateStatus,
  Image,
  InteractionManager,
  StyleSheet,
  Text,
  View,
  ViewToken,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PressableScale from "../components/PressableScale";
import NavigatorModal from "../components/quran/navigator/NavigatorModal";
import QuranAyahCard from "../components/quran/QuranAyahCard";
import QuranBookmarkModal, {
  QuranBookmarkModalPayload,
} from "../components/quran/QuranBookmarkModal";
import QuranCompletionCard from "../components/quran/QuranCompletionCard";

type AyahItem = {
  type: "ayah";
  ayah: NormalizedAyah;
  key: string;
  ayahGlobalIndex: number;
};

type CompletionItem = {
  type: "completion";
  key: string;
};

type QuranListItem = AyahItem | CompletionItem;

type ViewableItemsChanged = {
  viewableItems: ViewToken[];
};

type JumpTarget =
  | { kind: "surah"; surahNumber: number }
  | { kind: "juz"; juzNumber: number };

const ESTIMATED_ITEM_SIZE = 260;

function normalizeSearchValue(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function computeSurahMatchScore(value: string, query: string): number {
  const normalizedValue = normalizeSearchValue(value);
  const normalizedQuery = normalizeSearchValue(query);

  if (!normalizedQuery) {
    return 0;
  }

  if (normalizedValue === normalizedQuery) {
    return 1000;
  }

  if (normalizedValue.startsWith(normalizedQuery)) {
    return 850 - normalizedValue.length;
  }

  const index = normalizedValue.indexOf(normalizedQuery);
  if (index !== -1) {
    return 700 - index;
  }

  let score = 0;
  let cursor = 0;
  for (const char of normalizedQuery) {
    const foundIndex = normalizedValue.indexOf(char, cursor);
    if (foundIndex === -1) {
      return 0;
    }
    score += 40 - Math.min(foundIndex - cursor, 30);
    cursor = foundIndex + 1;
  }

  return Math.max(score, 1);
}

type BookmarkListItem = {
  bookmark: QuranBookmark;
  title: string;
  note: string;
  surahEnglish: string;
  surahArabic: string;
};

function computeBookmarkMatchScore(
  item: BookmarkListItem,
  query: string
): number {
  const fields = [
    item.title,
    item.note,
    item.surahEnglish,
    item.surahArabic,
    String(item.bookmark.surahNumber),
    `${item.bookmark.surahNumber}:${item.bookmark.ayahNumber}`,
  ].filter(Boolean) as string[];

  let score = 0;
  for (const field of fields) {
    score = Math.max(score, computeSurahMatchScore(field, query));
    if (score >= 1000) {
      break;
    }
  }
  return score;
}

export default function QuranScreen() {
  const ayat = useMemo(() => Array.from(getAllAyat()), []);
  const surahs = useMemo(() => Array.from(getSurahMeta()), []);
  const { width } = useWindowDimensions();
  const isSmall = width < 360;

  const { listData, ayahToItemIndex, juzFirstItemIndex, surahMap } =
    useMemo(() => {
      const metaBySurah = new Map<number, NormalizedSurahMeta>();
      for (const surah of surahs) {
        metaBySurah.set(surah.surahNumber, surah);
      }

      const items: QuranListItem[] = [];
      const ayahIndexToItem: number[] = [];
      const firstJuzIndex = new Map<number, number>();

      ayat.forEach((ayah, ayahIndex) => {
        const itemIndex = items.length;
        items.push({
          type: "ayah",
          ayah,
          key: `${ayah.surahNumber}:${ayah.ayahNumber}`,
          ayahGlobalIndex: ayahIndex,
        });
        ayahIndexToItem.push(itemIndex);

        if (!firstJuzIndex.has(ayah.juzNumber)) {
          firstJuzIndex.set(ayah.juzNumber, itemIndex);
        }
      });

      items.push({ type: "completion", key: "completion" });

      return {
        listData: items,
        ayahToItemIndex: ayahIndexToItem,
        juzFirstItemIndex: firstJuzIndex,
        surahMap: metaBySurah,
      };
    }, [ayat, surahs]);

  const flashListRef = useRef<FlashListRef<QuranListItem>>(null);
  const isProgrammaticScrollRef = useRef(false);
  const hasAppliedInitialScrollRef = useRef(false);
  const animatedScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [surahSearchQuery, setSurahSearchQuery] = useState("");
  const [bookmarkSearchQuery, setBookmarkSearchQuery] = useState("");

  const [initialAyahIndex, setInitialAyahIndex] = useState(0);
  const [listReady, setListReady] = useState(false);

  const [currentAyah, setCurrentAyah] = useState<NormalizedAyah>(
    ayat[0] ?? {
      surahNumber: 1,
      surahNameAr: "",
      surahNameEn: "",
      juzNumber: 1,
      ayahNumber: 1,
      arabicText: "",
      englishText: "",
    }
  );

  const [bookmarks, setBookmarks] = useState<QuranBookmark[]>([]);
  const [bookmarkModalContext, setBookmarkModalContext] = useState<{
    ayah: NormalizedAyah;
    ayahGlobalIndex: number;
    bookmark?: QuranBookmark;
  } | null>(null);
  const [bookmarkSaving, setBookmarkSaving] = useState(false);
  const {
    isPlaying,
    isAudioLoading,
    audioIconName,
    audioAccessibilityLabel,
    pauseAudio,
    stopAudio,
    offlinePillVisible,
    playSurah,
    pendingSurahFocusNumber,
    clearPendingSurahFocus,
  } = useQuranAudioController();

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        setIsAudioActiveAsync(true).catch((error) =>
          console.warn("Failed to reactivate audio session", error)
        );
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const stored = await getBookmarks();
      if (mounted) {
        setBookmarks(stored);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const savedIndex = await getLastReadAyahIndex();
      if (!mounted) return;
      let safeIndex = typeof savedIndex === "number" ? savedIndex : 0;
      if (safeIndex < 0 || safeIndex >= ayahToItemIndex.length) {
        safeIndex = 0;
      }
      setInitialAyahIndex(safeIndex);
      setCurrentAyah(ayat[safeIndex] ?? ayat[0]);
      setListReady(true);
      isProgrammaticScrollRef.current = true;
      InteractionManager.runAfterInteractions(() => {
        isProgrammaticScrollRef.current = false;
      });
    })();
    return () => {
      mounted = false;
    };
  }, [ayat, ayahToItemIndex.length]);

  const scrollToItemIndex = useCallback(
    (itemIndex: number, options?: { animateFinal?: boolean }) => {
      if (itemIndex < 0 || itemIndex >= listData.length) {
        return;
      }

      const list = flashListRef.current;
      if (!list) {
        return;
      }

      const animateFinal = options?.animateFinal ?? true;

      if (animatedScrollTimeoutRef.current) {
        clearTimeout(animatedScrollTimeoutRef.current);
        animatedScrollTimeoutRef.current = null;
      }

      const attemptScroll = (animated: boolean) => {
        try {
          list.scrollToIndex({
            index: itemIndex,
            animated,
            viewPosition: 0,
          });
          return true;
        } catch (error) {
          console.warn("scrollToIndex failed; falling back to offset", error);
          const fallbackOffset = Math.max(0, itemIndex * ESTIMATED_ITEM_SIZE);
          try {
            list.scrollToOffset({ offset: fallbackOffset, animated });
            return true;
          } catch (fallbackError) {
            console.warn(
              "scrollToOffset fallback failed; list may not be ready yet",
              fallbackError
            );
            return false;
          }
        }
      };

      isProgrammaticScrollRef.current = true;
      attemptScroll(false);

      if (!animateFinal) {
        InteractionManager.runAfterInteractions(() => {
          isProgrammaticScrollRef.current = false;
        });
        return;
      }

      animatedScrollTimeoutRef.current = setTimeout(() => {
        InteractionManager.runAfterInteractions(() => {
          attemptScroll(true);
          isProgrammaticScrollRef.current = false;
        });
        animatedScrollTimeoutRef.current = null;
      }, 50);
    },
    [listData.length]
  );

  const scrollToAyahIndex = useCallback(
    (ayahGlobalIndex: number, options?: { animateFinal?: boolean }) => {
      const itemIndex = ayahToItemIndex[ayahGlobalIndex];
      if (typeof itemIndex !== "number") return;
      scrollToItemIndex(itemIndex, options);
    },
    [ayahToItemIndex, scrollToItemIndex]
  );

  useEffect(() => {
    if (
      pendingSurahFocusNumber == null ||
      !listReady ||
      !hasAppliedInitialScrollRef.current
    ) {
      return;
    }

    try {
      const ayahIndex = getAyatIndexForSurahAndAyah(pendingSurahFocusNumber, 1);
      scrollToAyahIndex(ayahIndex);
    } catch (error) {
      console.warn("Failed to focus requested surah", error);
    } finally {
      clearPendingSurahFocus();
    }
  }, [
    pendingSurahFocusNumber,
    listReady,
    scrollToAyahIndex,
    clearPendingSurahFocus,
  ]);

  const scrollToTopAnimated = useCallback(() => {
    const list = flashListRef.current;
    if (!list) {
      return;
    }

    if (animatedScrollTimeoutRef.current) {
      clearTimeout(animatedScrollTimeoutRef.current);
      animatedScrollTimeoutRef.current = null;
    }

    isProgrammaticScrollRef.current = true;

    try {
      list.scrollToOffset({ offset: 0, animated: true });
    } catch (error) {
      console.warn("Animated scrollToOffset to top failed", error);
      try {
        list.scrollToIndex({ index: 0, animated: true, viewPosition: 0 });
      } catch (fallbackError) {
        console.warn("Fallback scrollToIndex to top failed", fallbackError);
        isProgrammaticScrollRef.current = false;
        return;
      }
    }

    InteractionManager.runAfterInteractions(() => {
      isProgrammaticScrollRef.current = false;
    });
  }, []);

  const handleScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      const { index, averageItemLength } = info;
      if (!flashListRef.current) return;
      const offset = Math.max(
        0,
        index * (averageItemLength || ESTIMATED_ITEM_SIZE)
      );
      flashListRef.current.scrollToOffset({ offset, animated: false });
      setTimeout(() => {
        if (!flashListRef.current) return;
        try {
          flashListRef.current.scrollToIndex({
            index,
            animated: false,
            viewPosition: 0,
          });
        } catch (error) {
          console.warn("Retry scrollToIndex failed", error);
        }
      }, 50);
    },
    []
  );

  const handleJump = useCallback(
    (target: JumpTarget) => {
      if (target.kind === "surah") {
        try {
          const ayahIndex = getAyatIndexForSurahAndAyah(target.surahNumber, 1);
          scrollToAyahIndex(ayahIndex);
        } catch (error) {
          console.warn("Failed to locate surah", error);
        }
      } else if (target.kind === "juz") {
        const itemIndex = juzFirstItemIndex.get(target.juzNumber);
        if (typeof itemIndex === "number") {
          scrollToItemIndex(itemIndex);
        }
      }
      setNavigatorOpen(false);
    },
    [juzFirstItemIndex, scrollToAyahIndex, scrollToItemIndex]
  );

  const viewabilityConfigRef = useRef({
    itemVisiblePercentThreshold: 60,
  });

  useEffect(() => {
    if (listReady && !hasAppliedInitialScrollRef.current) {
      hasAppliedInitialScrollRef.current = true;
    }
  }, [listReady]);

  useEffect(() => {
    return () => {
      if (animatedScrollTimeoutRef.current) {
        clearTimeout(animatedScrollTimeoutRef.current);
        animatedScrollTimeoutRef.current = null;
      }
    };
  }, []);

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: ViewableItemsChanged) => {
      for (const token of viewableItems) {
        const item = token.item as QuranListItem | undefined;
        if (!item || item.type !== "ayah") continue;
        const ayah = item.ayah;
        setCurrentAyah(ayah);
        if (isProgrammaticScrollRef.current) {
          break;
        }
        saveLastReadAyahIndex(item.ayahGlobalIndex);
        saveLastReadSurahAndAyah(ayah.surahNumber, ayah.ayahNumber);
        break;
      }
    },
    []
  );

  const bookmarkMap = useMemo(() => {
    const map = new Map<string, QuranBookmark>();
    bookmarks.forEach((bookmark) => {
      map.set(
        getBookmarkKey(bookmark.surahNumber, bookmark.ayahNumber),
        bookmark
      );
    });
    return map;
  }, [bookmarks]);

  const bookmarkedAyahKeys = useMemo(() => {
    return new Set(
      bookmarks.map((bookmark) =>
        getBookmarkKey(bookmark.surahNumber, bookmark.ayahNumber)
      )
    );
  }, [bookmarks]);

  const bookmarkItems = useMemo<BookmarkListItem[]>(() => {
    return bookmarks.map((bookmark) => {
      const surahMeta = surahMap.get(bookmark.surahNumber);
      return {
        bookmark,
        title: bookmark.title,
        note: bookmark.note ?? "",
        surahEnglish: surahMeta?.englishName ?? bookmark.title,
        surahArabic: surahMeta?.arabicName ?? "",
      };
    });
  }, [bookmarks, surahMap]);
  const currentSurahMeta = surahMap.get(currentAyah.surahNumber);

  const handleAudioButtonPress = useCallback(() => {
    if (isPlaying) {
      pauseAudio();
      return;
    }

    const englishName =
      currentSurahMeta?.englishName ?? currentAyah.surahNameEn;
    const arabicName = currentSurahMeta?.arabicName ?? currentAyah.surahNameAr;

    playSurah({
      surahNumber: currentAyah.surahNumber,
      englishName,
      arabicName,
    });
  }, [currentAyah, currentSurahMeta, isPlaying, pauseAudio, playSurah]);

  const filteredSurahs = useMemo<NormalizedSurahMeta[]>(() => {
    const query = surahSearchQuery.trim();
    if (!query) {
      return surahs;
    }

    return surahs
      .map((surah) => {
        const score = Math.max(
          computeSurahMatchScore(surah.englishName, query),
          computeSurahMatchScore(surah.arabicName, query),
          computeSurahMatchScore(String(surah.surahNumber), query)
        );
        return { surah, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return a.surah.surahNumber - b.surah.surahNumber;
      })
      .map((entry) => entry.surah);
  }, [surahSearchQuery, surahs]);

  const filteredBookmarkItems = useMemo<BookmarkListItem[]>(() => {
    const query = bookmarkSearchQuery.trim();
    if (!query) {
      return bookmarkItems;
    }
    return bookmarkItems
      .map((item) => ({
        item,
        score: computeBookmarkMatchScore(item, query),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return b.item.bookmark.updatedAt - a.item.bookmark.updatedAt;
      })
      .map((entry) => entry.item);
  }, [bookmarkItems, bookmarkSearchQuery]);

  useEffect(() => {
    if (!navigatorOpen) {
      if (surahSearchQuery) {
        setSurahSearchQuery("");
      }
      if (bookmarkSearchQuery) {
        setBookmarkSearchQuery("");
      }
    }
  }, [bookmarkSearchQuery, navigatorOpen, surahSearchQuery]);

  const handleAyahDoubleTap = useCallback(
    (ayah: NormalizedAyah, ayahGlobalIndex: number, ayahKey: string) => {
      const existing = bookmarkMap.get(ayahKey);
      setBookmarkModalContext({
        ayah,
        ayahGlobalIndex,
        bookmark: existing,
      });
    },
    [bookmarkMap]
  );

  const renderItem = useCallback<ListRenderItem<QuranListItem>>(
    ({ item }: ListRenderItemInfo<QuranListItem>) => {
      if (item.type === "ayah") {
        const surahMetaForAyah = surahMap.get(item.ayah.surahNumber);
        const isSurahStart =
          item.ayah.ayahNumber === 1 && item.ayahGlobalIndex !== 0;
        const ayahKey = item.key;

        return (
          <QuranAyahCard
            ayah={item.ayah}
            isSurahStart={isSurahStart}
            surahMeta={surahMetaForAyah}
            isBookmarked={bookmarkedAyahKeys.has(ayahKey)}
            onDoubleTap={() =>
              handleAyahDoubleTap(item.ayah, item.ayahGlobalIndex, ayahKey)
            }
          />
        );
      }

      return <QuranCompletionCard onBackToTop={scrollToTopAnimated} />;
    },
    [bookmarkedAyahKeys, handleAyahDoubleTap, scrollToTopAnimated, surahMap]
  );

  const getItemType = useCallback((item: QuranListItem) => {
    if (item.type === "completion") {
      return "completion";
    }

    const isSurahStart =
      item.ayah.ayahNumber === 1 && item.ayahGlobalIndex !== 0;

    return isSurahStart ? "ayahWithDivider" : "ayah";
  }, []);

  const keyExtractor = useCallback((item: QuranListItem) => item.key, []);

  const initialItemIndex = ayahToItemIndex[initialAyahIndex] ?? 0;
  const initialScrollIndexValue = !hasAppliedInitialScrollRef.current
    ? initialItemIndex
    : undefined;

  const handleBookmarkSubmit = useCallback(
    async ({ title, note }: QuranBookmarkModalPayload) => {
      if (!bookmarkModalContext) {
        return;
      }
      setBookmarkSaving(true);
      try {
        const updated = await upsertBookmark({
          id: bookmarkModalContext.bookmark?.id,
          surahNumber: bookmarkModalContext.ayah.surahNumber,
          ayahNumber: bookmarkModalContext.ayah.ayahNumber,
          ayahGlobalIndex: bookmarkModalContext.ayahGlobalIndex,
          title,
          note,
        });
        setBookmarks(updated);
        setBookmarkModalContext(null);
      } catch (error) {
        console.warn("Failed to save bookmark", error);
        Alert.alert(
          "Bookmark",
          "Unable to save bookmark right now. Please try again."
        );
      } finally {
        setBookmarkSaving(false);
      }
    },
    [bookmarkModalContext]
  );

  const handleBookmarkModalClose = useCallback(() => {
    if (bookmarkSaving) {
      return;
    }
    setBookmarkModalContext(null);
  }, [bookmarkSaving]);

  const handleSelectBookmark = useCallback(
    (bookmark: QuranBookmark) => {
      scrollToAyahIndex(bookmark.ayahGlobalIndex);
      setNavigatorOpen(false);
    },
    [scrollToAyahIndex]
  );

  const handleDeleteBookmark = useCallback(async (bookmark: QuranBookmark) => {
    try {
      const updated = await deleteBookmark(bookmark.id);
      setBookmarks(updated);
      setBookmarkModalContext((context) => {
        if (context?.bookmark && context.bookmark.id === bookmark.id) {
          return null;
        }
        return context;
      });
    } catch (error) {
      console.warn("Failed to delete bookmark", error);
      Alert.alert(
        "Bookmark",
        "Unable to delete bookmark right now. Please try again."
      );
    }
  }, []);

  const isBookmarkModalVisible = Boolean(bookmarkModalContext);
  const bookmarkModalAyah = bookmarkModalContext?.ayah ?? null;
  const bookmarkModalInitialTitle = bookmarkModalContext?.bookmark?.title;
  const bookmarkModalInitialNote = bookmarkModalContext?.bookmark?.note ?? "";

  return (
    <LinearGradient
      colors={[
        themeColors.primaryDeep,
        themeColors.primary,
        themeColors.primaryLift,
      ]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <Image
        source={require("@/assets/patterns/islamic-gold.png")}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.05,
          resizeMode: "repeat",
          width: "100%",
          height: "100%",
        }}
      />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text
              style={[
                styles.headerTitle,
                {
                  fontSize: isSmall ? 34 : 40,
                  fontFamily: "SFProDisplay-Bold",
                },
              ]}
            >
              Quran
            </Text>
            <View style={styles.headerSubsection}>
              <View style={styles.headerDetails}>
                <Text style={styles.headerSurahEnglish}>
                  {currentSurahMeta?.englishName ?? ""}
                </Text>
                <Text style={styles.headerSurahArabic}>
                  {currentSurahMeta?.arabicName ?? ""}
                </Text>
                <Text style={styles.headerMeta}>
                  Ayah {currentAyah.ayahNumber} • Juz {currentAyah.juzNumber}
                </Text>
              </View>
              <View style={styles.headerActions}>
                {!offlinePillVisible ? (
                  <PressableScale
                    style={[
                      styles.audioButton,
                      isAudioLoading && styles.audioButtonDisabled,
                    ]}
                    onPress={handleAudioButtonPress}
                    onLongPress={stopAudio}
                    disabled={isAudioLoading}
                    accessibilityRole="button"
                    accessibilityLabel={audioAccessibilityLabel}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={audioIconName}
                      size={18}
                      color={themeColors.primaryDeep}
                      style={styles.audioIcon}
                    />
                  </PressableScale>
                ) : (
                  <View
                    style={[
                      styles.audioButton,
                      styles.audioButtonDisabled,
                      styles.audioOfflinePill,
                    ]}
                    accessibilityRole="text"
                  >
                    <Ionicons
                      name="cloud-offline-outline"
                      size={18}
                      color={themeColors.primaryDeep}
                    />
                    <Text style={styles.audioOfflineText}>Offline</Text>
                  </View>
                )}
                <PressableScale
                  style={styles.jumpButton}
                  onPress={() => setNavigatorOpen(true)}
                  accessibilityRole="button"
                >
                  <Text style={styles.jumpButtonText}>Navigate</Text>
                </PressableScale>
              </View>
            </View>
          </View>

          {listReady ? (
            <FlashList
              ref={flashListRef}
              data={listData}
              showsVerticalScrollIndicator={false}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              estimatedItemSize={ESTIMATED_ITEM_SIZE}
              getItemType={getItemType}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              initialScrollIndex={initialScrollIndexValue}
              onViewableItemsChanged={handleViewableItemsChanged}
              viewabilityConfig={viewabilityConfigRef.current}
              onScrollToIndexFailed={handleScrollToIndexFailed}
            />
          ) : (
            <View style={styles.listPlaceholder} />
          )}

          <NavigatorModal
            visible={navigatorOpen}
            surahs={surahs}
            filteredSurahs={filteredSurahs}
            surahSearchQuery={surahSearchQuery}
            bookmarks={bookmarkItems}
            filteredBookmarks={filteredBookmarkItems}
            bookmarkSearchQuery={bookmarkSearchQuery}
            onSurahSearchQueryChange={setSurahSearchQuery}
            onBookmarkSearchQueryChange={setBookmarkSearchQuery}
            onSelectSurah={(surahNumber) =>
              handleJump({ kind: "surah", surahNumber })
            }
            onSelectJuz={(juzNumber) => handleJump({ kind: "juz", juzNumber })}
            onSelectBookmark={handleSelectBookmark}
            onDeleteBookmark={handleDeleteBookmark}
            onClose={() => setNavigatorOpen(false)}
          />

          <QuranBookmarkModal
            visible={isBookmarkModalVisible}
            ayah={bookmarkModalAyah}
            initialTitle={bookmarkModalInitialTitle}
            initialNote={bookmarkModalInitialNote}
            onSubmit={handleBookmarkSubmit}
            onClose={handleBookmarkModalClose}
            isSubmitting={bookmarkSaving}
          />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    marginBottom: 12,
  },
  headerTitle: {
    color: themeColors.white,
    marginBottom: 6,
  },
  headerSubsection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerDetails: {
    flexShrink: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerSurahEnglish: {
    color: themeColors.white,
    fontSize: 18,
    fontWeight: "600",
  },
  headerSurahArabic: {
    color: themeColors.accent,
    fontSize: 20,
    marginTop: 2,
    marginBottom: 4,
    textAlign: "left",
  },
  headerMeta: {
    color: themeColors.white,
    fontSize: 14,
    opacity: 0.75,
  },
  audioButton: {
    backgroundColor: themeColors.accent,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  audioButtonDisabled: {
    opacity: 0.6,
  },
  audioIcon: {
    alignSelf: "center",
  },
  audioOfflinePill: {
    flexDirection: "row",
    alignItems: "center",
  },
  audioOfflineText: {
    color: themeColors.primaryDeep,
    fontWeight: "600",
    fontSize: 12,
    marginLeft: 6,
  },
  jumpButton: {
    backgroundColor: themeColors.accent,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginLeft: 12,
  },
  jumpButtonText: {
    color: themeColors.primaryDeep,
    fontWeight: "600",
    fontSize: 14,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 56,
  },
  listPlaceholder: {
    flex: 1,
  },
  footerNoteContainer: {
    paddingTop: 6,
    paddingBottom: 12,
    alignItems: "center",
  },
  footerNote: {
    color: withOpacity(themeColors.white, 0.65),
    fontSize: 11,
    textAlign: "center",
  },
});
