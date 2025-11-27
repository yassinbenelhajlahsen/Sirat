import {
  FlashList,
  FlashListRef,
  ListRenderItem,
  ListRenderItemInfo,
} from "@shopify/flash-list";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  InteractionManager,
  Platform,
  StyleSheet,
  Text,
  View,
  ViewToken,
  useWindowDimensions,
} from "react-native";

import { colors as themeColors } from "@/app/constants/theme";
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
import PressableScale from "../components/PressableScale";
import QuranAyahCard from "../components/QuranAyahCard";
import QuranCompletionCard from "../components/QuranCompletionCard";
import QuranNavigatorModal from "../components/QuranNavigatorModal";

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

const ESTIMATED_ITEM_SIZE = 120;

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

  const currentSurahMeta = surahMap.get(currentAyah.surahNumber);

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

  useEffect(() => {
    if (!navigatorOpen && surahSearchQuery) {
      setSurahSearchQuery("");
    }
  }, [navigatorOpen, surahSearchQuery]);

  const renderItem = useCallback<ListRenderItem<QuranListItem>>(
    ({ item }: ListRenderItemInfo<QuranListItem>) => {
      if (item.type === "ayah") {
        const surahMetaForAyah = surahMap.get(item.ayah.surahNumber);
        const isSurahStart =
          item.ayah.ayahNumber === 1 && item.ayahGlobalIndex !== 0;

        return (
          <QuranAyahCard
            ayah={item.ayah}
            isSurahStart={isSurahStart}
            surahMeta={surahMetaForAyah}
          />
        );
      }

      return <QuranCompletionCard onBackToTop={scrollToTopAnimated} />;
    },
    [scrollToTopAnimated, surahMap]
  );

  const getItemType = useCallback((item: QuranListItem) => {
    return item.type === "ayah" ? "ayah" : "divider";
  }, []);

  const keyExtractor = useCallback((item: QuranListItem) => item.key, []);

  const initialItemIndex = ayahToItemIndex[initialAyahIndex] ?? 0;
  const initialScrollIndexValue = !hasAppliedInitialScrollRef.current
    ? initialItemIndex
    : undefined;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text
          style={[
            styles.headerTitle,
            { fontSize: isSmall ? 34 : 40, fontFamily: "SFProDisplay-Bold" },
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
          <PressableScale
            style={styles.jumpButton}
            onPress={() => setNavigatorOpen(true)}
            accessibilityRole="button"
          >
            <Text style={styles.jumpButtonText}>Navigate</Text>
          </PressableScale>
        </View>
      </View>

      {listReady ? (
        <FlashList
          ref={flashListRef}
          data={listData}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          estimatedItemSize={ESTIMATED_ITEM_SIZE}
          getItemType={getItemType}
          style={styles.list}
          disableAutoLayout={true}
          overrideItemLayout={(layout, item) => layout}
          contentContainerStyle={styles.listContent}
          initialScrollIndex={initialScrollIndexValue}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={viewabilityConfigRef.current}
          onScrollToIndexFailed={handleScrollToIndexFailed}
        />
      ) : (
        <View style={styles.listPlaceholder} />
      )}

      <QuranNavigatorModal
        visible={navigatorOpen}
        surahs={surahs}
        filteredSurahs={filteredSurahs}
        surahSearchQuery={surahSearchQuery}
        onSurahSearchQueryChange={setSurahSearchQuery}
        onSelectSurah={(surahNumber) =>
          handleJump({ kind: "surah", surahNumber })
        }
        onSelectJuz={(juzNumber) => handleJump({ kind: "juz", juzNumber })}
        onClose={() => setNavigatorOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.primary,
    paddingTop: Platform.select({ ios: 56, android: 48, default: 40 }),
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
    paddingBottom: 32,
  },
  listPlaceholder: {
    flex: 1,
  },
});
