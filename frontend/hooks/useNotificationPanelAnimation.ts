import { useCallback, useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

import { type PrayerKey, type SoundMode } from "../utils/notifications/constants";

const CONTENT_MAX_HEIGHT = 820;

type Params = {
  loaded: boolean;
  enabled: boolean;
  soundMode: SoundMode;
};

export function useNotificationPanelAnimation({
  loaded,
  enabled,
  soundMode,
}: Params) {
  const headerScale = useRef(new Animated.Value(1)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const soundIndicator = useRef(
    new Animated.Value(soundMode === "adhan" ? 1 : 0),
  ).current;

  const bellAnimations = useRef<Record<PrayerKey, Animated.Value>>({
    Fajr: new Animated.Value(1),
    Sunrise: new Animated.Value(1),
    Dhuhr: new Animated.Value(1),
    Asr: new Animated.Value(1),
    Maghrib: new Animated.Value(1),
    Isha: new Animated.Value(1),
  }).current;

  const initialAnimSet = useRef(false);

  useEffect(() => {
    if (!loaded) return;

    if (!initialAnimSet.current) {
      contentAnim.setValue(enabled ? 1 : 0);
      initialAnimSet.current = true;
      return;
    }

    Animated.timing(contentAnim, {
      toValue: enabled ? 1 : 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [contentAnim, enabled, loaded]);

  useEffect(() => {
    Animated.timing(soundIndicator, {
      toValue: soundMode === "adhan" ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.poly(4)),
      useNativeDriver: true,
    }).start();
  }, [soundIndicator, soundMode]);

  const pulseHeader = useCallback(() => {
    Animated.sequence([
      Animated.timing(headerScale, {
        toValue: 0.96,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(headerScale, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [headerScale]);

  const pulsePrayer = useCallback(
    (key: PrayerKey) => {
      const anim = bellAnimations[key];
      anim.setValue(1);
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 0.9,
          duration: 90,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 1,
          duration: 120,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    },
    [bellAnimations],
  );

  const contentOpacity = contentAnim;
  const contentTranslateY = contentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, 0],
  });
  const contentMaxHeight = contentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, CONTENT_MAX_HEIGHT],
  });
  const contentScale = contentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.985, 1],
  });

  return {
    headerScale,
    bellAnimations,
    contentOpacity,
    contentTranslateY,
    contentMaxHeight,
    contentScale,
    soundIndicator,
    pulseHeader,
    pulsePrayer,
  };
}
