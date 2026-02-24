import { usePathname } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { useQuranAudioController } from "@/context/QuranAudioProvider";

import { MINI_PLAYER_ANIMATION_MS, QuranMiniPlayer } from "./QuranMiniPlayer";

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
  const hideOnMap = pathname?.startsWith("/MosqueMap");

  const [shouldRender, setShouldRender] = useState(miniPlayerVisible);
  const [displaySurahMeta, setDisplaySurahMeta] = useState(currentSurahMeta);

  useEffect(() => {
    if (currentSurahMeta) {
      setDisplaySurahMeta(currentSurahMeta);
    } else if (!miniPlayerVisible && !shouldRender) {
      setDisplaySurahMeta(null);
    }
  }, [currentSurahMeta, miniPlayerVisible, shouldRender]);

  useEffect(() => {
    if (miniPlayerVisible) {
      setShouldRender(true);
      return;
    }
    const timeout = setTimeout(
      () => setShouldRender(false),
      MINI_PLAYER_ANIMATION_MS
    );
    return () => clearTimeout(timeout);
  }, [miniPlayerVisible]);

  if (hideOnMap || (!miniPlayerVisible && !shouldRender)) {
    return null;
  }

  const isTabRoute = pathname?.startsWith("/(tabs)");
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
        visible={miniPlayerVisible && !hideOnMap}
        onPlay={playCurrentSurah}
        onPause={pauseAudio}
        onStop={stopPlaybackSession}
        onNavigateToSurah={requestCurrentSurahFocus}
        style={isTabRoute ? styles.tabPosition : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tabPosition: {
    bottom: 106,
  },
});

export default QuranMiniPlayerPortal;
