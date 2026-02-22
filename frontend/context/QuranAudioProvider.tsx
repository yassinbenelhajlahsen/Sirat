import {
  type PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { UseQuranAudioResult } from "@/hooks/useQuranAudio";
import { useQuranAudio } from "@/hooks/useQuranAudio";
import { getSurahMeta } from "@/services/quranData";

const TOTAL_SURAHS = 114;

export type QuranSurahMeta = {
  surahNumber: number;
  englishName?: string;
  arabicName?: string;
};

type QuranAudioContextValue = UseQuranAudioResult & {
  currentSurahMeta: QuranSurahMeta | null;
  playSurah: (meta: QuranSurahMeta) => void;
  miniPlayerVisible: boolean;
  stopPlaybackSession: () => Promise<void>;
  requestCurrentSurahFocus: () => void;
  pendingSurahFocusNumber: number | null;
  clearPendingSurahFocus: () => void;
};

const QuranAudioContext = createContext<QuranAudioContextValue | null>(null);

export function QuranAudioProvider({ children }: PropsWithChildren) {
  const [currentSurahMeta, setCurrentSurahMeta] =
    useState<QuranSurahMeta | null>(null);
  const [currentSurahNumber, setCurrentSurahNumber] = useState<number>(1);
  const [pendingAction, setPendingAction] = useState<"play" | null>(null);
  const [pendingSurahFocusNumber, setPendingSurahFocusNumber] = useState<
    number | null
  >(null);

  const onSurahCompleteRef = useRef<((surahNumber: number) => void) | null>(
    null
  );

  const [surahMetaList, setSurahMetaList] = useState<
    readonly { surahNumber: number; englishName?: string; arabicName?: string }[]
  >([]);

  useEffect(() => {
    // getSurahMeta() requires preloadQuranData() to have completed.
    // On mount this may not be ready yet, so we retry after a short delay.
    const tryLoad = () => {
      try {
        setSurahMetaList(getSurahMeta());
        return true;
      } catch {
        return false;
      }
    };

    if (!tryLoad()) {
      const id = setInterval(() => {
        if (tryLoad()) clearInterval(id);
      }, 200);
      return () => clearInterval(id);
    }
  }, []);

  const surahMetaByNumber = useMemo(() => {
    const map = new Map<number, QuranSurahMeta>();
    for (const meta of surahMetaList) {
      map.set(meta.surahNumber, {
        surahNumber: meta.surahNumber,
        englishName: meta.englishName,
        arabicName: meta.arabicName,
      });
    }
    return map;
  }, [surahMetaList]);

  const lastSurahNumber = useMemo(
    () => surahMetaList[surahMetaList.length - 1]?.surahNumber ?? TOTAL_SURAHS,
    [surahMetaList]
  );

  const queueSurahByNumber = useCallback(
    (surahNumber: number) => {
      const metaFromLookup = surahMetaByNumber.get(surahNumber);
      const meta: QuranSurahMeta =
        metaFromLookup ??
        ({
          surahNumber,
        } as QuranSurahMeta);

      setCurrentSurahMeta(meta);
      setCurrentSurahNumber(surahNumber);
      setPendingAction("play");
    },
    [surahMetaByNumber]
  );

  const handleSurahCompleteBridge = useCallback((surahNumber: number) => {
    onSurahCompleteRef.current?.(surahNumber);
  }, []);

  const audio = useQuranAudio({
    currentSurahNumber,
    onSurahComplete: handleSurahCompleteBridge,
  });
  const {
    audioPlayer,
    isAudioLoading,
    playbackPosition,
    playCurrentSurah,
    stopAudio,
  } = audio;

  useEffect(() => {
    if (pendingAction !== "play") {
      return;
    }

    let isCancelled = false;

    playCurrentSurah()
      .catch(() => {
        // Errors are already handled within playCurrentSurah.
      })
      .finally(() => {
        if (!isCancelled) {
          setPendingAction(null);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [pendingAction, playCurrentSurah]);

  const playSurah = useCallback((meta: QuranSurahMeta) => {
    setCurrentSurahMeta(meta);
    setCurrentSurahNumber(meta.surahNumber);
    setPendingAction("play");
  }, []);

  const stopPlaybackSession = useCallback(async () => {
    try {
      await stopAudio();
    } catch {
      // stopAudio already logs internally
    } finally {
      setPendingAction(null);
      setCurrentSurahMeta(null);
      setPendingSurahFocusNumber(null);
    }
  }, [stopAudio]);

  const requestCurrentSurahFocus = useCallback(() => {
    if (currentSurahMeta) {
      setPendingSurahFocusNumber(currentSurahMeta.surahNumber);
    }
  }, [currentSurahMeta]);

  const clearPendingSurahFocus = useCallback(() => {
    setPendingSurahFocusNumber(null);
  }, []);

  const miniPlayerVisible = useMemo(() => {
    if (!currentSurahMeta) {
      return false;
    }

    return (
      pendingAction === "play" ||
      isAudioLoading ||
      !!audioPlayer ||
      playbackPosition > 0
    );
  }, [
    audioPlayer,
    currentSurahMeta,
    isAudioLoading,
    pendingAction,
    playbackPosition,
  ]);

  const value = useMemo(
    () => ({
      ...audio,
      currentSurahMeta,
      playSurah,
      miniPlayerVisible,
      stopPlaybackSession,
      requestCurrentSurahFocus,
      pendingSurahFocusNumber,
      clearPendingSurahFocus,
    }),
    [
      audio,
      currentSurahMeta,
      miniPlayerVisible,
      playSurah,
      stopPlaybackSession,
      requestCurrentSurahFocus,
      pendingSurahFocusNumber,
      clearPendingSurahFocus,
    ]
  );

  const handleSurahComplete = useCallback(
    (completedSurahNumber: number) => {
      const nextSurahNumber = completedSurahNumber + 1;

      if (nextSurahNumber > lastSurahNumber) {
        stopPlaybackSession();
        return;
      }

      queueSurahByNumber(nextSurahNumber);
    },
    [lastSurahNumber, queueSurahByNumber, stopPlaybackSession]
  );

  useEffect(() => {
    onSurahCompleteRef.current = handleSurahComplete;
  }, [handleSurahComplete]);

  return (
    <QuranAudioContext.Provider value={value}>
      {children}
    </QuranAudioContext.Provider>
  );
}

export function useQuranAudioController() {
  const context = useContext(QuranAudioContext);
  if (!context) {
    throw new Error(
      "useQuranAudioController must be used within a QuranAudioProvider"
    );
  }
  return context;
}
