import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useState } from "react";

import { SoundMode } from "../util/notifications/constants";

const ADHAN_SOURCE = require("../assets/sounds/adhan.wav");

export function useAdhanPreview(enabled: boolean) {
  const player = useAudioPlayer(ADHAN_SOURCE);
  const status = useAudioPlayerStatus(player);
  const [previewing, setPreviewing] = useState<SoundMode | null>(null);

  const cleanupPreview = useCallback(async () => {
    if (!player) return;
    try {
      player.pause();
    } catch {
      // ignore pause errors
    }
    try {
      if (player.isLoaded) {
        await player.seekTo(0);
      }
    } catch {
      // ignore seek errors
    }
  }, [player]);

  const stopPreview = useCallback(async () => {
    setPreviewing(null);
    try {
      await cleanupPreview();
    } catch {
      // ignore cleanup errors
    }
  }, [cleanupPreview]);

  const playPreview = useCallback(
    async (mode: SoundMode) => {
      await cleanupPreview();
      if (mode === "default") {
        setPreviewing(null);
        return;
      }

      if (!player) {
        setPreviewing(null);
        return;
      }

      try {
        if (player.isLoaded) {
          await player.seekTo(0);
        }
      } catch {
        // ignore seek errors
      }

      try {
        setPreviewing(mode);
        player.play();
      } catch {
        setPreviewing(null);
      }
    },
    [cleanupPreview, player]
  );

  const handlePreviewPress = useCallback(
    (mode: SoundMode) => {
      if (previewing === mode) {
        void stopPreview();
        return;
      }
      void playPreview(mode);
    },
    [playPreview, previewing, stopPreview]
  );

  useEffect(() => {
    if (!enabled) {
      void stopPreview();
    }
  }, [enabled, stopPreview]);

  useEffect(() => {
    return () => {
      void stopPreview();
    };
  }, [stopPreview]);

  useEffect(() => {
    if (previewing === "adhan" && status?.didJustFinish) {
      void stopPreview();
    }
  }, [previewing, status?.didJustFinish, stopPreview]);

  return {
    previewing,
    playPreview,
    handlePreviewPress,
    stopPreview,
  };
}
