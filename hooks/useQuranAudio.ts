import { getSurahAudioUrl } from "@/services/quranAudio";
import type { AudioPlayer, AudioStatus } from "expo-audio";
import {
  createAudioPlayer,
  setAudioModeAsync,
  setIsAudioActiveAsync,
} from "expo-audio";
import * as Network from "expo-network";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

type UseQuranAudioOptions = {
  currentSurahNumber: number;
};

export type UseQuranAudioResult = {
  isOnline: boolean;
  isPlaying: boolean;
  isAudioLoading: boolean;
  audioIconName: "play" | "pause";
  audioAccessibilityLabel: string;
  audioPlayer: AudioPlayer | null;
  playbackDuration: number;
  playbackPosition: number;
  playCurrentSurah: () => Promise<void>;
  pauseAudio: () => Promise<void>;
  stopAudio: () => Promise<void>;
  offlinePillVisible: boolean;
};

const NETWORK_POLL_INTERVAL_MS = 3000;

export function useQuranAudio({
  currentSurahNumber,
}: UseQuranAudioOptions): UseQuranAudioResult {
  const [audioPlayer, setAudioPlayer] = useState<AudioPlayer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [activeSurahNumber, setActiveSurahNumber] = useState<number | null>(
    null
  );
  const [isOnline, setIsOnline] = useState(true);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [playbackPosition, setPlaybackPosition] = useState(0);

  const playbackSubscriptionRef = useRef<{ remove: () => void } | null>(null);
  const hasConfiguredAudioSessionRef = useRef(false);
  const audioSessionActiveRef = useRef(false);
  const lastPlaybackStatusRef = useRef<{
    isLoaded: boolean;
    playing: boolean;
    currentTime: number;
  } | null>(null);
  const previousOnlineStatusRef = useRef(true);

  const ensureAudioSession = useCallback(async () => {
    try {
      if (!hasConfiguredAudioSessionRef.current) {
        await setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: "mixWithOthers",
          interruptionModeAndroid: "duckOthers",
          allowsRecording: false,
          shouldPlayInBackground: true,
          shouldRouteThroughEarpiece: false,
        });
        hasConfiguredAudioSessionRef.current = true;
      }

      if (!audioSessionActiveRef.current) {
        await setIsAudioActiveAsync(true);
        audioSessionActiveRef.current = true;
      }
    } catch (error) {
      console.warn("Failed to configure audio session", error);
    }
  }, []);

  const handlePlaybackStatusUpdate = useCallback((status: AudioStatus) => {
    if (!status?.isLoaded) {
      lastPlaybackStatusRef.current = {
        isLoaded: false,
        playing: false,
        currentTime: 0,
      };
      setIsPlaying(false);
      setPlaybackDuration(0);
      setPlaybackPosition(0);
      return;
    }

    if (status.didJustFinish) {
      setIsPlaying(false);
      if (audioSessionActiveRef.current) {
        setIsAudioActiveAsync(false)
          .then(() => {
            audioSessionActiveRef.current = false;
          })
          .catch((error) =>
            console.warn("Failed to deactivate audio after completion", error)
          );
      }
    } else {
      setIsPlaying(status.playing);
    }

    lastPlaybackStatusRef.current = {
      isLoaded: status.isLoaded,
      playing: status.playing,
      currentTime: status.currentTime ?? 0,
    };
    setPlaybackDuration((prev) =>
      typeof status.duration === "number" ? status.duration : prev
    );
    setPlaybackPosition(status.currentTime ?? 0);
  }, []);

  const pauseAudio = useCallback(async () => {
    if (!audioPlayer) {
      return;
    }

    try {
      audioPlayer.pause();
      setIsPlaying(false);
    } catch (error) {
      console.warn("Failed to pause surah audio", error);
      Alert.alert("Audio", "Unable to pause audio right now.");
    }
  }, [audioPlayer]);

  const stopAudio = useCallback(async () => {
    if (!audioPlayer) {
      return;
    }

    try {
      audioPlayer.pause();
      await audioPlayer.seekTo(0);
    } catch (error) {
      console.warn("Failed to stop surah audio", error);
    } finally {
      setIsPlaying(false);
      setPlaybackPosition(0);
      if (audioSessionActiveRef.current) {
        setIsAudioActiveAsync(false)
          .then(() => {
            audioSessionActiveRef.current = false;
          })
          .catch((error) =>
            console.warn("Failed to deactivate audio after stop", error)
          );
      }
    }
  }, [audioPlayer]);

  const playCurrentSurah = useCallback(async () => {
    if (isAudioLoading) {
      return;
    }

    if (!isOnline) {
      Alert.alert(
        "No internet connection",
        "Quran audio requires an online connection."
      );
      return;
    }

    if (!currentSurahNumber) {
      return;
    }

    await ensureAudioSession();

    if (audioPlayer && activeSurahNumber === currentSurahNumber) {
      try {
        const status = audioPlayer.currentStatus;
        if (status?.didJustFinish) {
          await audioPlayer.seekTo(0);
        }
        audioPlayer.play();
        setIsPlaying(true);
      } catch (error) {
        console.warn("Failed to resume surah audio", error);
        Alert.alert("Audio", "Unable to resume audio playback.");
      }
      return;
    }

    setIsAudioLoading(true);
    try {
      if (audioPlayer) {
        try {
          audioPlayer.pause();
        } catch (error) {
          console.warn("Failed to pause existing audio", error);
        }
      }

      const audioUrl = getSurahAudioUrl(currentSurahNumber);
      const player = createAudioPlayer(audioUrl);
      setAudioPlayer(player);
      setActiveSurahNumber(currentSurahNumber);
      setPlaybackDuration(0);
      setPlaybackPosition(0);

      player.play();
      setIsPlaying(true);
    } catch (error) {
      console.warn("Failed to play surah audio", error);
      Alert.alert("Audio", "Unable to play surah audio right now.");
    } finally {
      setIsAudioLoading(false);
    }
  }, [
    activeSurahNumber,
    audioPlayer,
    currentSurahNumber,
    ensureAudioSession,
    isAudioLoading,
    isOnline,
  ]);

  useEffect(() => {
    let mounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const updateNetworkStatus = async () => {
      try {
        const status = await Network.getNetworkStateAsync();
        const nextOnline =
          status?.isConnected === true && status?.isInternetReachable === true;
        if (mounted) {
          setIsOnline((prev) => (prev === nextOnline ? prev : nextOnline));
        }
      } catch (error) {
        console.warn("Failed to fetch network state", error);
        if (mounted) {
          setIsOnline(false);
        }
      }
    };

    updateNetworkStatus();
    intervalId = setInterval(updateNetworkStatus, NETWORK_POLL_INTERVAL_MS);

    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  useEffect(() => {
    if (!audioPlayer) {
      return;
    }

    const subscription = (
      audioPlayer as unknown as {
        addListener?: (
          event: string,
          listener: (status: AudioStatus) => void
        ) => { remove: () => void };
      }
    )?.addListener?.("playbackStatusUpdate", handlePlaybackStatusUpdate);

    playbackSubscriptionRef.current = subscription ?? null;

    return () => {
      subscription?.remove?.();
      playbackSubscriptionRef.current = null;
    };
  }, [audioPlayer, handlePlaybackStatusUpdate]);

  useEffect(() => {
    return () => {
      playbackSubscriptionRef.current?.remove?.();
      playbackSubscriptionRef.current = null;

      if (audioPlayer) {
        try {
          audioPlayer.pause();
        } catch (error) {
          console.warn("Failed to pause audio during cleanup", error);
        }
        try {
          audioPlayer.remove();
        } catch (error) {
          console.warn("Failed to release audio player during cleanup", error);
        }
      }

      setPlaybackDuration(0);
      setPlaybackPosition(0);

      if (audioSessionActiveRef.current) {
        setIsAudioActiveAsync(false).catch((error) =>
          console.warn("Failed to deactivate audio", error)
        );
        audioSessionActiveRef.current = false;
      }
    };
  }, [audioPlayer]);

  useEffect(() => {
    if (!audioPlayer || activeSurahNumber === null) {
      return;
    }

    if (activeSurahNumber === currentSurahNumber) {
      return;
    }

    playbackSubscriptionRef.current?.remove?.();
    playbackSubscriptionRef.current = null;

    try {
      audioPlayer.pause();
    } catch (error) {
      console.warn("Failed to pause audio on surah change", error);
    }

    audioPlayer
      .seekTo(0)
      .catch((error) =>
        console.warn("Failed to reset audio position on surah change", error)
      );

    setIsPlaying(false);
    setAudioPlayer(null);
    setActiveSurahNumber(null);
    setPlaybackDuration(0);
    setPlaybackPosition(0);
  }, [audioPlayer, activeSurahNumber, currentSurahNumber]);

  useEffect(() => {
    const wasOnline = previousOnlineStatusRef.current;
    if (wasOnline && !isOnline && isPlaying) {
      stopAudio();
    }
    previousOnlineStatusRef.current = isOnline;
  }, [isOnline, isPlaying, stopAudio]);

  const audioIconName = isPlaying ? "pause" : "play";
  const audioAccessibilityLabel = isPlaying
    ? "Pause surah audio"
    : "Play surah audio";

  return {
    isOnline,
    isPlaying,
    isAudioLoading,
    audioIconName,
    audioAccessibilityLabel,
    audioPlayer,
    playbackDuration,
    playbackPosition,
    playCurrentSurah,
    pauseAudio,
    stopAudio,
    offlinePillVisible: !isOnline,
  };
}
