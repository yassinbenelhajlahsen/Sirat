import { usePathname } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { useQuranAudioController } from "@/context/QuranAudioProvider";

import useModalTransition from "@/hooks/useModalTransition";
import { QuranMiniPlayer } from "./QuranMiniPlayer";

export function QuranMiniPlayerPortal() {
  const {
    audioPlayer,
    isPlaying,
    playbackDuration,
    playbackPosition,
    playCurrentSurah,
    pauseAudio,
    currentSurahMeta,
    miniPlayerVisible,
    stopPlaybackSession,
    requestCurrentSurahFocus,
  } = useQuranAudioController();

  const pathname = usePathname();

  const { shouldRender, cardAnimatedStyle } = useModalTransition(
    Boolean(miniPlayerVisible),
  );

  const isTabRoute = pathname?.startsWith("/(tabs)");
  const [displaySurahMeta, setDisplaySurahMeta] = useState(currentSurahMeta);

  // Maintain displayed surah meta while we are rendering during exit animation
  useEffect(() => {
    if (currentSurahMeta) {
      setDisplaySurahMeta(currentSurahMeta);
    } else if (!miniPlayerVisible && !shouldRender) {
      setDisplaySurahMeta(null);
    }
  }, [currentSurahMeta, miniPlayerVisible, shouldRender]);

  if (!shouldRender) {
    return null;
  }

  const surahName =
    displaySurahMeta?.englishName ?? displaySurahMeta?.arabicName ?? "Surah";

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <QuranMiniPlayer
        audioPlayer={audioPlayer}
        surahName={surahName}
        isPlaying={isPlaying}
        playbackDuration={playbackDuration}
        playbackPosition={playbackPosition}
        visible={miniPlayerVisible}
        onPlay={playCurrentSurah}
        onPause={pauseAudio}
        onStop={stopPlaybackSession}
        onNavigateToSurah={requestCurrentSurahFocus}
        style={
          isTabRoute
            ? [styles.tabPosition, cardAnimatedStyle, { opacity: 1 }]
            : [cardAnimatedStyle, { opacity: 1 }]
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tabPosition: {
    bottom: 0,
  },
});

export default QuranMiniPlayerPortal;
