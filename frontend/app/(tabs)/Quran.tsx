import Aurora from "@/components/ui/Aurora";
import { Caption, Headline } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useQuranAudioController } from "@/context/QuranAudioProvider";
import { useTheme } from "@/context/ThemeContext";
import { useQuranDisplayModes } from "@/hooks/useQuranDisplayModes";
import { handleTabBarScroll } from "@/utils/tabBarChrome";
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
  AccessibilityInfo,
  Alert,
  Animated,
  AppState,
  AppStateStatus,
  Clipboard,
  InteractionManager,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHaptics } from "@/hooks/useHaptics";
import { TIMING_ENTER } from "@/constants/motion";
import PressableScale from "../../components/PressableScale";
import NavigatorModal from "../../components/quran/navigator/NavigatorModal";
import QuranAyahCard from "../../components/quran/QuranAyahCard";
import QuranBookmarkModal, {
  QuranBookmarkModalPayload,
} from "../../components/quran/QuranBookmarkModal";
import QuranCompletionCard from "../../components/quran/QuranCompletionCard";
import QuranDisplaySettingsModal from "../../components/quran/QuranDisplaySettingsModal";
import QuranCopySheet from "../../components/quran/QuranCopySheet";
import CopyToast from "../../components/CopyToast";

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
  | { kind: "juz"; juzNumber: number }
  | { kind: "ayah"; surahNumber: number; ayahNumber: number };

type QuranAyahSearchResult = {
  surahNumber: number;
  ayahNumber: number;
  surahEnglishName: string;
  englishText: string;
};

type QuranJuzSearchResult = {
  juzNumber: number;
};

type NavigatorInitialTab = "surah" | "juz" | "bookmarks";

const ESTIMATED_ITEM_SIZE = 260;
const HEADER_HEIGHT = 64;

function normalizeArabicDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776));
}

function normalizeSearchValue(value: string): string {
  return normalizeArabicDigits(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeTransliterationValue(value: string): string {
  return normalizeSearchValue(value)
    .replace(/[^a-z0-9]/g, "")
    .replace(/(aa|ah)/g, "a")
    .replace(/(ee|ii)/g, "i")
    .replace(/(oo|uu)/g, "u")
    .replace(/yy/g, "y");
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

function parseNumericLookup(
  query: string,
): { surahNumber: number; ayahNumber?: number } | null {
  const normalized = normalizeArabicDigits(query).trim().replace(/\s+/g, "");
  const match = normalized.match(/^(\d{1,3})(?:[:.](\d{1,3}))?$/);
  if (!match) {
    return null;
  }

  const surahNumber = Number(match[1]);
  if (!Number.isFinite(surahNumber) || surahNumber <= 0) {
    return null;
  }

  if (!match[2]) {
    return { surahNumber };
  }

  const ayahNumber = Number(match[2]);
  if (!Number.isFinite(ayahNumber) || ayahNumber <= 0) {
    return null;
  }

  return { surahNumber, ayahNumber };
}

function parseJuzLookup(query: string): number | null {
  const normalized = normalizeArabicDigits(query).trim().toLowerCase();
  const match = normalized.match(/^(?:j|juz)\s*(\d{1,2})$/);
  if (!match) {
    return null;
  }
  const juzNumber = Number(match[1]);
  if (!Number.isFinite(juzNumber) || juzNumber < 1 || juzNumber > 30) {
    return null;
  }
  return juzNumber;
}

function parseMixedSurahAyahLookup(
  query: string,
  surahs: readonly NormalizedSurahMeta[],
): { surahNumber: number; ayahNumber: number } | null {
  const normalized = normalizeSearchValue(query).trim();
  if (!normalized) {
    return null;
  }

  const numberMatch = normalized.match(/\b(\d{1,3})\b/);
  if (!numberMatch) {
    return null;
  }

  const ayahNumber = Number(numberMatch[1]);
  if (!Number.isFinite(ayahNumber) || ayahNumber <= 0) {
    return null;
  }

  const textPart = normalized.replace(numberMatch[0], " ").trim();
  if (!textPart) {
    return null;
  }

  const bestMatch = surahs
    .map((surah) => ({
      surah,
      score: computeSurahSearchScore(surah, textPart),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)[0];

  if (!bestMatch || ayahNumber > bestMatch.surah.ayahCount) {
    return null;
  }

  return {
    surahNumber: bestMatch.surah.surahNumber,
    ayahNumber,
  };
}

function getSurahSearchCandidates(surah: NormalizedSurahMeta): string[] {
  const base = surah.englishName;
  const normalized = normalizeSearchValue(base);
  const noPrefix = normalized.replace(/^al[\s-]*/, "");

  const aliases: string[] = [];
  if (surah.surahNumber === 2) {
    aliases.push("baqarah", "baqara", "baqar");
  }
  if (surah.surahNumber === 36) {
    aliases.push("yasin", "ya sin", "yaseen", "yaseen");
  }
  if (surah.surahNumber === 67) {
    aliases.push("mulk");
  }

  return [base, normalized, noPrefix, ...aliases];
}

function computeSurahSearchScore(
  surah: NormalizedSurahMeta,
  query: string,
): number {
  const queryNormalized = normalizeSearchValue(query);
  const queryPhonetic = normalizeTransliterationValue(query);
  const candidates = [
    ...getSurahSearchCandidates(surah),
    surah.arabicName,
    String(surah.surahNumber),
  ];

  return candidates.reduce((maxScore, candidate) => {
    const directScore = computeSurahMatchScore(candidate, queryNormalized);
    const phoneticCandidate = normalizeTransliterationValue(candidate);
    const phoneticScore = queryPhonetic
      ? computeSurahMatchScore(phoneticCandidate, queryPhonetic)
      : 0;
    return Math.max(maxScore, directScore, phoneticScore);
  }, 0);
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
  query: string,
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
  const { theme } = useTheme();
  const themeColors = theme.colors;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const haptic = useHaptics();
  const listOpacity = useRef(new Animated.Value(0)).current;

  const ayat = useMemo(() => Array.from(getAllAyat()), []);
  const surahs = useMemo(() => Array.from(getSurahMeta()), []);
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
  const topVisibleAyahIndexRef = useRef<number | null>(null);
  const hasAppliedInitialScrollRef = useRef(false);
  const hasRestoredInitialPositionRef = useRef(false);
  const displayModeAnchorInteractionRef = useRef<{
    cancel: () => void;
  } | null>(null);
  const displayModeAnchorRafRef = useRef<number | null>(null);
  const displayModeAnchorResetRafRef = useRef<number | null>(null);
  const displayModeSignatureRef = useRef<string | null>(null);
  const displayModeAnchorSequenceRef = useRef(0);
  const animatedScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const initialRestoreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [navigatorInitialTab, setNavigatorInitialTab] =
    useState<NavigatorInitialTab>("surah");
  const [displaySettingsOpen, setDisplaySettingsOpen] = useState(false);
  const [copySheetAyah, setCopySheetAyah] = useState<NormalizedAyah | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
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
      transliteration: "",
    },
  );
  const { isModeEnabled } = useQuranDisplayModes();
  const showArabic = isModeEnabled("arabic");
  const showEnglish = isModeEnabled("english");
  const showTransliteration = isModeEnabled("transliteration");

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
          console.warn("Failed to reactivate audio session", error),
        );
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
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
      if (initialRestoreTimeoutRef.current) {
        clearTimeout(initialRestoreTimeoutRef.current);
        initialRestoreTimeoutRef.current = null;
      }
      setInitialAyahIndex(safeIndex);
      setCurrentAyah(ayat[safeIndex] ?? ayat[0]);
      setListReady(true);
      hasRestoredInitialPositionRef.current = false;
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
              fallbackError,
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
    [listData.length],
  );

  const scrollToAyahIndex = useCallback(
    (ayahGlobalIndex: number, options?: { animateFinal?: boolean }) => {
      const itemIndex = ayahToItemIndex[ayahGlobalIndex];
      if (typeof itemIndex !== "number") return;
      scrollToItemIndex(itemIndex, options);
    },
    [ayahToItemIndex, scrollToItemIndex],
  );

  const handleListLoad = useCallback(() => {
    if (hasRestoredInitialPositionRef.current || !listReady) {
      return;
    }

    hasRestoredInitialPositionRef.current = true;

    if (initialAyahIndex <= 0) {
      return;
    }

    scrollToAyahIndex(initialAyahIndex, { animateFinal: false });

    if (initialRestoreTimeoutRef.current) {
      clearTimeout(initialRestoreTimeoutRef.current);
      initialRestoreTimeoutRef.current = null;
    }

    initialRestoreTimeoutRef.current = setTimeout(() => {
      scrollToAyahIndex(initialAyahIndex, { animateFinal: false });
      initialRestoreTimeoutRef.current = null;
    }, 120);
  }, [initialAyahIndex, listReady, scrollToAyahIndex]);

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
        index * (averageItemLength || ESTIMATED_ITEM_SIZE),
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
    [],
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
      } else if (target.kind === "ayah") {
        try {
          const ayahIndex = getAyatIndexForSurahAndAyah(
            target.surahNumber,
            target.ayahNumber,
          );
          scrollToAyahIndex(ayahIndex);
        } catch (error) {
          console.warn("Failed to locate ayah", error);
        }
      }
      setNavigatorOpen(false);
    },
    [juzFirstItemIndex, scrollToAyahIndex, scrollToItemIndex],
  );

  const closeAllSheets = useCallback(() => {
    setNavigatorOpen(false);
    setDisplaySettingsOpen(false);
    setCopySheetAyah(null);
    setBookmarkModalContext(null);
  }, []);

  const openNavigator = useCallback((tab: NavigatorInitialTab = "surah") => {
    closeAllSheets();
    setNavigatorInitialTab(tab);
    setNavigatorOpen(true);
  }, [closeAllSheets]);

  const viewabilityConfigRef = useRef({
    itemVisiblePercentThreshold: 1,
  });

  useEffect(() => {
    if (listReady && !hasAppliedInitialScrollRef.current) {
      hasAppliedInitialScrollRef.current = true;
    }
  }, [listReady]);

  // Calm entrance fade-in when list becomes ready; skipped when Reduce Motion is on.
  useEffect(() => {
    if (!listReady) return;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced) {
        listOpacity.setValue(1);
        return;
      }
      Animated.timing(listOpacity, {
        toValue: 1,
        duration: TIMING_ENTER,
        useNativeDriver: true,
      }).start();
    }).catch(() => {
      listOpacity.setValue(1);
    });
  }, [listReady, listOpacity]);

  useEffect(() => {
    if (displayModeAnchorInteractionRef.current) {
      displayModeAnchorInteractionRef.current.cancel();
      displayModeAnchorInteractionRef.current = null;
    }
    if (displayModeAnchorRafRef.current != null) {
      cancelAnimationFrame(displayModeAnchorRafRef.current);
      displayModeAnchorRafRef.current = null;
    }
    if (displayModeAnchorResetRafRef.current != null) {
      cancelAnimationFrame(displayModeAnchorResetRafRef.current);
      displayModeAnchorResetRafRef.current = null;
    }
    return () => {
      if (animatedScrollTimeoutRef.current) {
        clearTimeout(animatedScrollTimeoutRef.current);
        animatedScrollTimeoutRef.current = null;
      }
      if (initialRestoreTimeoutRef.current) {
        clearTimeout(initialRestoreTimeoutRef.current);
        initialRestoreTimeoutRef.current = null;
      }
      if (displayModeAnchorInteractionRef.current) {
        displayModeAnchorInteractionRef.current.cancel();
        displayModeAnchorInteractionRef.current = null;
      }
      if (displayModeAnchorRafRef.current != null) {
        cancelAnimationFrame(displayModeAnchorRafRef.current);
        displayModeAnchorRafRef.current = null;
      }
      if (displayModeAnchorResetRafRef.current != null) {
        cancelAnimationFrame(displayModeAnchorResetRafRef.current);
        displayModeAnchorResetRafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const displayModeSignature = `${showArabic ? "1" : "0"}${showEnglish ? "1" : "0"}${showTransliteration ? "1" : "0"}`;
    if (displayModeSignatureRef.current === null) {
      displayModeSignatureRef.current = displayModeSignature;
      return;
    }
    if (displayModeSignatureRef.current === displayModeSignature) {
      return;
    }
    displayModeSignatureRef.current = displayModeSignature;

    if (!listReady) return;
    if (!hasAppliedInitialScrollRef.current) return;
    if (pendingSurahFocusNumber != null) return;

    const index = topVisibleAyahIndexRef.current;
    if (index == null) return;

    if (displayModeAnchorInteractionRef.current) {
      displayModeAnchorInteractionRef.current.cancel();
      displayModeAnchorInteractionRef.current = null;
    }
    if (displayModeAnchorRafRef.current != null) {
      cancelAnimationFrame(displayModeAnchorRafRef.current);
      displayModeAnchorRafRef.current = null;
    }
    if (displayModeAnchorResetRafRef.current != null) {
      cancelAnimationFrame(displayModeAnchorResetRafRef.current);
      displayModeAnchorResetRafRef.current = null;
    }

    const sequence = ++displayModeAnchorSequenceRef.current;
    isProgrammaticScrollRef.current = true;

    displayModeAnchorInteractionRef.current =
      InteractionManager.runAfterInteractions(() => {
        if (sequence !== displayModeAnchorSequenceRef.current) {
          return;
        }
        displayModeAnchorRafRef.current = requestAnimationFrame(() => {
          if (sequence !== displayModeAnchorSequenceRef.current) {
            return;
          }
          scrollToAyahIndex(index, { animateFinal: false });
          displayModeAnchorResetRafRef.current = requestAnimationFrame(() => {
            if (sequence !== displayModeAnchorSequenceRef.current) {
              return;
            }
            isProgrammaticScrollRef.current = false;
            displayModeAnchorResetRafRef.current = null;
          });
          displayModeAnchorRafRef.current = null;
        });
      });
  }, [
    listReady,
    pendingSurahFocusNumber,
    scrollToAyahIndex,
    showArabic,
    showEnglish,
    showTransliteration,
  ]);

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: ViewableItemsChanged) => {
      let topVisibleAyahItem: AyahItem | null = null;
      let topVisibleAyahIndex = Number.POSITIVE_INFINITY;

      for (const token of viewableItems) {
        if (!token.isViewable) continue;

        const tokenIndex = token.index;
        if (typeof tokenIndex !== "number") continue;

        const item = token.item as QuranListItem | undefined;
        if (!item || item.type !== "ayah") continue;

        if (tokenIndex < topVisibleAyahIndex) {
          topVisibleAyahIndex = tokenIndex;
          topVisibleAyahItem = item;
        }
      }

      if (!topVisibleAyahItem) {
        return;
      }

      topVisibleAyahIndexRef.current = topVisibleAyahItem.ayahGlobalIndex;

      const ayah = topVisibleAyahItem.ayah;
      setCurrentAyah(ayah);
      if (isProgrammaticScrollRef.current) {
        return;
      }

      saveLastReadAyahIndex(topVisibleAyahItem.ayahGlobalIndex);
      saveLastReadSurahAndAyah(ayah.surahNumber, ayah.ayahNumber);
    },
    [],
  );

  const bookmarkMap = useMemo(() => {
    const map = new Map<string, QuranBookmark>();
    bookmarks.forEach((bookmark) => {
      map.set(
        getBookmarkKey(bookmark.surahNumber, bookmark.ayahNumber),
        bookmark,
      );
    });
    return map;
  }, [bookmarks]);

  const bookmarkedAyahKeys = useMemo(() => {
    return new Set(
      bookmarks.map((bookmark) =>
        getBookmarkKey(bookmark.surahNumber, bookmark.ayahNumber),
      ),
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

    const juzLookup = parseJuzLookup(query);
    if (juzLookup) {
      return [];
    }

    const numericLookup = parseNumericLookup(query);
    if (numericLookup && !numericLookup.ayahNumber) {
      const exactSurah = surahMap.get(numericLookup.surahNumber);
      return exactSurah ? [exactSurah] : [];
    }

    const normalized = normalizeSearchValue(query);
    const tokenizedQuery = normalized
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 0 && !/^\d+$/.test(token));

    return surahs
      .map((surah) => {
        const fullQueryScore = computeSurahSearchScore(surah, query);
        const tokenScore = tokenizedQuery.reduce((maxScore, token) => {
          return Math.max(maxScore, computeSurahSearchScore(surah, token));
        }, 0);

        return { surah, score: Math.max(fullQueryScore, tokenScore) };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return a.surah.surahNumber - b.surah.surahNumber;
      })
      .map((entry) => entry.surah);
  }, [surahMap, surahSearchQuery, surahs]);

  const filteredAyahResults = useMemo<QuranAyahSearchResult[]>(() => {
    const query = surahSearchQuery.trim();
    if (!query) {
      return [];
    }

    const results = new Map<string, QuranAyahSearchResult>();
    const numericLookup = parseNumericLookup(query);
    const juzLookup = parseJuzLookup(query);

    if (juzLookup) {
      return [];
    }

    if (numericLookup?.ayahNumber) {
      try {
        const ayahIndex = getAyatIndexForSurahAndAyah(
          numericLookup.surahNumber,
          numericLookup.ayahNumber,
        );
        const ayah = ayat[ayahIndex];
        if (ayah) {
          results.set(`${ayah.surahNumber}:${ayah.ayahNumber}`, {
            surahNumber: ayah.surahNumber,
            ayahNumber: ayah.ayahNumber,
            surahEnglishName:
              surahMap.get(ayah.surahNumber)?.englishName ??
              ayah.surahNameEn ??
              `Surah ${ayah.surahNumber}`,
            englishText: ayah.englishText,
          });
        }
      } catch {
        // Invalid numeric ayah lookup.
      }
    }

    if (
      numericLookup &&
      !numericLookup.ayahNumber &&
      numericLookup.surahNumber === 255
    ) {
      try {
        const ayahIndex = getAyatIndexForSurahAndAyah(2, 255);
        const ayah = ayat[ayahIndex];
        if (ayah) {
          results.set("2:255", {
            surahNumber: 2,
            ayahNumber: 255,
            surahEnglishName:
              surahMap.get(2)?.englishName ?? ayah.surahNameEn ?? "Surah 2",
            englishText: ayah.englishText,
          });
        }
      } catch {
        // Ignore if dataset is missing this ayah.
      }
    }

    const mixedLookup = parseMixedSurahAyahLookup(query, surahs);
    if (mixedLookup) {
      try {
        const ayahIndex = getAyatIndexForSurahAndAyah(
          mixedLookup.surahNumber,
          mixedLookup.ayahNumber,
        );
        const ayah = ayat[ayahIndex];
        if (ayah) {
          results.set(`${ayah.surahNumber}:${ayah.ayahNumber}`, {
            surahNumber: ayah.surahNumber,
            ayahNumber: ayah.ayahNumber,
            surahEnglishName:
              surahMap.get(ayah.surahNumber)?.englishName ??
              ayah.surahNameEn ??
              `Surah ${ayah.surahNumber}`,
            englishText: ayah.englishText,
          });
        }
      } catch {
        // Ignore invalid mixed lookup.
      }
    }

    const normalizedQuery = normalizeSearchValue(query);
    if (!normalizedQuery || /^\d+$/.test(normalizedQuery)) {
      return Array.from(results.values());
    }

    const textMatches = ayat
      .map((ayah) => {
        const normalizedEnglish = normalizeSearchValue(ayah.englishText);
        const matchIndex = normalizedEnglish.indexOf(normalizedQuery);
        if (matchIndex === -1) {
          return null;
        }
        const score = normalizedEnglish.startsWith(normalizedQuery)
          ? 1000 - normalizedEnglish.length
          : 800 - matchIndex;
        return { ayah, score };
      })
      .filter(
        (
          entry,
        ): entry is {
          ayah: NormalizedAyah;
          score: number;
        } => entry !== null,
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 18);

    for (const entry of textMatches) {
      const ayahKey = `${entry.ayah.surahNumber}:${entry.ayah.ayahNumber}`;
      if (results.has(ayahKey)) {
        continue;
      }
      results.set(ayahKey, {
        surahNumber: entry.ayah.surahNumber,
        ayahNumber: entry.ayah.ayahNumber,
        surahEnglishName:
          surahMap.get(entry.ayah.surahNumber)?.englishName ??
          entry.ayah.surahNameEn ??
          `Surah ${entry.ayah.surahNumber}`,
        englishText: entry.ayah.englishText,
      });
    }

    return Array.from(results.values());
  }, [ayat, surahMap, surahSearchQuery, surahs]);

  const filteredJuzResult = useMemo<QuranJuzSearchResult | null>(() => {
    const query = surahSearchQuery.trim();
    if (!query) {
      return null;
    }
    const juzNumber = parseJuzLookup(query);
    if (!juzNumber) {
      return null;
    }
    return { juzNumber };
  }, [surahSearchQuery]);

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
      if (existing) {
        openNavigator("bookmarks");
        return;
      }
      closeAllSheets();
      setBookmarkModalContext({
        ayah,
        ayahGlobalIndex,
        bookmark: existing,
      });
    },
    [bookmarkMap, openNavigator, closeAllSheets],
  );

  const handleAyahLongPress = useCallback((ayah: NormalizedAyah) => {
    haptic("light");
    closeAllSheets();
    setCopySheetAyah(ayah);
  }, [haptic, closeAllSheets]);

  const handleCopy = useCallback((text: string) => {
    Clipboard.setString(text);
    setCopySheetAyah(null);
    setToastVisible(true);
    haptic("success");
  }, [haptic]);

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
            showArabic={showArabic}
            showEnglish={showEnglish}
            showTransliteration={showTransliteration}
            isBookmarked={bookmarkedAyahKeys.has(ayahKey)}
            onDoubleTap={() =>
              handleAyahDoubleTap(item.ayah, item.ayahGlobalIndex, ayahKey)
            }
            onLongPress={() => handleAyahLongPress(item.ayah)}
          />
        );
      }

      return <QuranCompletionCard onBackToTop={scrollToTopAnimated} />;
    },
    [
      bookmarkedAyahKeys,
      handleAyahDoubleTap,
      handleAyahLongPress,
      scrollToTopAnimated,
      showArabic,
      showEnglish,
      showTransliteration,
      surahMap,
    ],
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
          "Unable to save bookmark right now. Please try again.",
        );
      } finally {
        setBookmarkSaving(false);
      }
    },
    [bookmarkModalContext],
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
    [scrollToAyahIndex],
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
        "Unable to delete bookmark right now. Please try again.",
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
      style={styles.screen}
    >
      <Aurora />
      <View style={styles.screen}>
        <View style={styles.container}>
          <LinearGradient
            colors={[themeColors.primaryDeep, themeColors.primary]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[styles.headerBar, { paddingTop: insets.top + 10 }]}
          >
            <View style={styles.headerText}>
              <View style={styles.headerTitleRow}>
                <Headline color={themeColors.white}>{currentSurahMeta?.englishName ?? ""}</Headline>
                <Text style={styles.headerArabic}>{currentSurahMeta?.arabicName ?? ""}</Text>
              </View>
              <Caption color={themeColors.accent}>
                Ayah {currentAyah.ayahNumber} · Juzʾ {currentAyah.juzNumber}
              </Caption>
            </View>
            <View style={styles.headerActions}>
              {offlinePillVisible ? (
                <View style={[styles.ctrl, styles.ctrlOffline]} accessibilityRole="text">
                  <Ionicons name="cloud-offline-outline" size={18} color={themeColors.white} />
                </View>
              ) : (
                <PressableScale
                  style={[styles.ctrl, styles.ctrlPlay, isAudioLoading && styles.ctrlDisabled]}
                  onPress={handleAudioButtonPress}
                  onLongPress={stopAudio}
                  disabled={isAudioLoading}
                  accessibilityRole="button"
                  accessibilityLabel={audioAccessibilityLabel}
                  hitSlop={8}
                >
                  <Ionicons name={audioIconName} size={18} color={themeColors.onAccent} />
                </PressableScale>
              )}
              <PressableScale style={styles.ctrl} onPress={() => openNavigator("surah")} accessibilityRole="button" accessibilityLabel="Navigate">
                <Ionicons name="search" size={18} color={themeColors.white} />
              </PressableScale>
              <PressableScale style={styles.ctrl} onPress={() => { closeAllSheets(); setDisplaySettingsOpen(true); }} accessibilityRole="button" accessibilityLabel="Display settings">
                <Text style={styles.aa}>Aa</Text>
              </PressableScale>
            </View>
          </LinearGradient>

          {listReady ? (
            <Animated.View style={[styles.list, { opacity: listOpacity }]}>
              <FlashList
                ref={flashListRef}
                data={listData}
                showsVerticalScrollIndicator={false}
                scrollsToTop={false}
                onScroll={handleTabBarScroll}
                scrollEventThrottle={16}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                estimatedItemSize={ESTIMATED_ITEM_SIZE}
                getItemType={getItemType}
                style={styles.list}
                contentContainerStyle={{ ...styles.listContent, paddingTop: HEADER_HEIGHT + insets.top, paddingBottom: insets.bottom + 72 }}
                contentInsetAdjustmentBehavior="never"
                onLoad={handleListLoad}
                onViewableItemsChanged={handleViewableItemsChanged}
                viewabilityConfig={viewabilityConfigRef.current}
                onScrollToIndexFailed={handleScrollToIndexFailed}
              />
            </Animated.View>
          ) : (
            <View style={styles.listPlaceholder} />
          )}

          <NavigatorModal
            visible={navigatorOpen}
            initialTab={navigatorInitialTab}
            surahs={surahs}
            filteredSurahs={filteredSurahs}
            ayahSearchResults={filteredAyahResults}
            juzSearchResult={filteredJuzResult}
            surahSearchQuery={surahSearchQuery}
            bookmarks={bookmarkItems}
            filteredBookmarks={filteredBookmarkItems}
            bookmarkSearchQuery={bookmarkSearchQuery}
            onSurahSearchQueryChange={setSurahSearchQuery}
            onBookmarkSearchQueryChange={setBookmarkSearchQuery}
            onSelectSurah={(surahNumber) =>
              handleJump({ kind: "surah", surahNumber })
            }
            onSelectAyah={(surahNumber, ayahNumber) =>
              handleJump({ kind: "ayah", surahNumber, ayahNumber })
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

          <QuranDisplaySettingsModal
            visible={displaySettingsOpen}
            onClose={() => setDisplaySettingsOpen(false)}
          />

          <QuranCopySheet
            visible={copySheetAyah !== null}
            ayah={copySheetAyah}
            showArabic={showArabic}
            showEnglish={showEnglish}
            showTransliteration={showTransliteration}
            onCopy={handleCopy}
            onClose={() => setCopySheetAyah(null)}
          />

          <CopyToast
            visible={toastVisible}
            onHide={() => setToastVisible(false)}
          />
        </View>
      </View>
    </LinearGradient>
  );
}

const createStyles = (theme: AppTheme) => {
  const themeColors = theme.colors;
  const { spacing, radii } = theme;

  return StyleSheet.create({
    screen: { flex: 1 },
    container: {
      flex: 1,
      backgroundColor: "transparent",
    },
    headerBar: {
      position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
      borderBottomWidth: 1, borderColor: withOpacity(themeColors.white, 0.12),
    },
    headerText: {
      flex: 1,
    },
    headerTitleRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
    headerArabic: { fontFamily: "SFProDisplay-Semibold", fontSize: 16, color: themeColors.accent },
    headerActions: { flexDirection: "row", gap: spacing.sm },
    ctrl: {
      width: 40, height: 40, borderRadius: radii.pill, alignItems: "center", justifyContent: "center",
      backgroundColor: withOpacity(themeColors.white, 0.1), borderWidth: 1, borderColor: withOpacity(themeColors.white, 0.18),
    },
    ctrlPlay: { backgroundColor: themeColors.accent, borderColor: themeColors.accent },
    ctrlOffline: { backgroundColor: withOpacity(themeColors.white, 0.08) },
    ctrlDisabled: { opacity: 0.5 },
    aa: { fontFamily: "SFProDisplay-Bold", fontSize: 14, color: themeColors.white },
    list: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xs,
      paddingBottom: 72,
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
};
