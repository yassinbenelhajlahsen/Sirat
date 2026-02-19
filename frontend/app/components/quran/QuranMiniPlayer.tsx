import { Ionicons } from "@expo/vector-icons";
import type { AudioPlayer } from "expo-audio";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors as themeColors, withOpacity } from "@/constants/theme";
import PressableScale from "../PressableScale";

const PROGRESS_POLL_INTERVAL_MS = 500;
const RESTART_THRESHOLD_SECONDS = 0.5;

export type QuranMiniPlayerProps = {
  audioPlayer: AudioPlayer | null;
  surahName?: string;
  isPlaying: boolean;
  playbackDuration: number;
  playbackPosition: number;
  visible: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void | Promise<void>;
  onNavigateToSurah?: () => void;
  style?: ViewStyle;
};

export const MINI_PLAYER_ANIMATION_MS = 180;

export function QuranMiniPlayer({
  audioPlayer,
  surahName,
  isPlaying,
  playbackDuration,
  playbackPosition,
  visible,
  onPlay,
  onPause,
  onStop,
  onNavigateToSurah,
  style,
}: QuranMiniPlayerProps) {
  const insets = useSafeAreaInsets();
  const TAB_BAR_GAP = 64;
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [duration, setDuration] = useState(playbackDuration);
  const [position, setPosition] = useState(playbackPosition);
  const router = useRouter();

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: visible ? 1 : 0,
      duration: MINI_PLAYER_ANIMATION_MS,
      useNativeDriver: true,
    }).start();
  }, [animatedValue, visible]);

  useEffect(() => {
    setDuration(playbackDuration);
  }, [playbackDuration]);

  useEffect(() => {
    setPosition(playbackPosition);
  }, [playbackPosition]);

  useEffect(() => {
    if (!visible || !audioPlayer) {
      return;
    }

    let isMounted = true;

    const updateFromPlayer = () => {
      if (!isMounted || !audioPlayer) return;
      const status = audioPlayer.currentStatus;
      if (!status) return;
      if (typeof status.duration === "number") {
        setDuration(status.duration);
      }
      if (typeof status.currentTime === "number") {
        setPosition(status.currentTime);
      }
    };

    updateFromPlayer();
    const intervalId = setInterval(updateFromPlayer, PROGRESS_POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [audioPlayer, visible]);

  const remainingSeconds = Math.max(duration - position, 0);
  const formattedRemaining = useMemo(() => {
    if (!Number.isFinite(remainingSeconds)) {
      return "00:00";
    }

    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = Math.floor(remainingSeconds % 60);

    if (hours > 0) {
      return [hours, minutes, seconds]
        .map((unit) => String(unit).padStart(2, "0"))
        .join(":");
    }

    if (minutes >= 0) {
      return [minutes, seconds]
        .map((unit) => String(unit).padStart(2, "0"))
        .join(":");
    }

    return String(seconds).padStart(2, "0");
  }, [remainingSeconds]);

  const progress = useMemo(() => {
    if (!duration || duration <= 0) {
      return 0;
    }
    return Math.min(Math.max(position / duration, 0), 1);
  }, [duration, position]);

  const shouldRestartFromBeginning = useMemo(
    () =>
      !isPlaying &&
      Number.isFinite(duration) &&
      Number.isFinite(position) &&
      duration > 0 &&
      duration - position <= RESTART_THRESHOLD_SECONDS,
    [duration, position, isPlaying]
  );

  const restartFromBeginning = useCallback(() => {
    if (!audioPlayer) return;

    const seekablePlayer = audioPlayer as unknown as {
      seekTo?: (timeSeconds: number) => Promise<void> | void;
      setCurrentTime?: (timeSeconds: number) => Promise<void> | void;
      setPosition?: (timeSeconds: number) => Promise<void> | void;
      playFromPosition?: (timeSeconds: number) => Promise<void> | void;
    };

    if (typeof seekablePlayer.seekTo === "function") {
      seekablePlayer.seekTo(0);
    } else if (typeof seekablePlayer.setCurrentTime === "function") {
      seekablePlayer.setCurrentTime(0);
    } else if (typeof seekablePlayer.setPosition === "function") {
      seekablePlayer.setPosition(0);
    } else if (typeof seekablePlayer.playFromPosition === "function") {
      seekablePlayer.playFromPosition(0);
    }

    setPosition(0);
  }, [audioPlayer]);

  const handleNavigateToQuran = useCallback(() => {
    onNavigateToSurah?.();
    router.navigate("/(tabs)/Quran");
  }, [onNavigateToSurah, router]);

  const handleStop = useCallback(
    (event?: GestureResponderEvent) => {
      event?.stopPropagation();
      onStop?.();
    },
    [onStop]
  );

  const onPressControl = (event?: GestureResponderEvent) => {
    event?.stopPropagation();

    if (shouldRestartFromBeginning) {
      restartFromBeginning();
    }

    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  };

  return (
    <PressableScale
      pointerEvents={visible ? "auto" : "none"}
      onPress={handleNavigateToQuran}
      accessibilityRole="button"
      accessibilityLabel="Open Quran screen"
      accessibilityHint="Navigates back to the Quran tab"
      style={[
        styles.wrapper,
        style,
        {
          opacity: animatedValue,
          transform: [
            {
              translateY: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [30, 0],
              }),
            },
          ],
          marginBottom: (insets.bottom > 0 ? insets.bottom : 12) + TAB_BAR_GAP,
        },
      ]}
    >
      <View style={styles.innerContainer}>
        <View style={styles.textSection}>
          <Text
            style={styles.surahName}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {surahName ?? ""}
          </Text>
          <Text style={styles.remainingLabel}>
            Time remaining · {formattedRemaining}
          </Text>
        </View>
        <View style={styles.controls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Stop audio"
            accessibilityHint="Stops playback and closes the mini player"
            onPress={handleStop}
            style={[styles.controlButton, styles.stopButton]}
          >
            <Ionicons name="stop" size={18} color={themeColors.white} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? "Pause audio" : "Play audio"}
            accessibilityHint="Controls the current surah audio playback"
            onPress={onPressControl}
            style={[styles.controlButton, styles.playButton]}
          >
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={22}
              color={themeColors.primaryDeep}
            />
          </Pressable>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <Animated.View
          style={[styles.progressFill, { width: `${progress * 100}%` }]}
        />
      </View>
    </PressableScale>
  );
}

export default QuranMiniPlayer;

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 0,
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  innerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 20,
    backgroundColor: withOpacity(themeColors.primaryDeep, 0.9),
    borderWidth: 1,
    borderColor: withOpacity(themeColors.white, 0.16),
    shadowColor: "#000",
    shadowOpacity: 0.32,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
  textSection: {
    flex: 1,
    marginRight: 12,
  },
  surahName: {
    color: themeColors.white,
    fontSize: 15,
    fontWeight: "600",
  },
  remainingLabel: {
    color: withOpacity(themeColors.white, 0.8),
    fontSize: 12,
    marginTop: 2,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
  },
  controlButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withOpacity(themeColors.white, 0.12),
    borderWidth: 1,
    borderColor: withOpacity(themeColors.white, 0.22),
  },
  stopButton: {
    marginRight: 8,
    backgroundColor: withOpacity(themeColors.white, 0.1),
  },
  playButton: {
    backgroundColor: themeColors.accent,
    borderColor: withOpacity(themeColors.accent, 0.85),
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: withOpacity(themeColors.white, 0.18),
    marginTop: 8,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: themeColors.accent,
  },
});
