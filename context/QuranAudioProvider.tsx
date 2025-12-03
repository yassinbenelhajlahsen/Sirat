import {
  type PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { UseQuranAudioResult } from "@/hooks/useQuranAudio";
import { useQuranAudio } from "@/hooks/useQuranAudio";

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

  const audio = useQuranAudio({ currentSurahNumber });
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
