import { useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";

export function useCalendarSummaryTransition(showRamadanSummary: boolean) {
  const ramadanSummaryAnim = useRef(new Animated.Value(0)).current;
  const [renderRamadanSummary, setRenderRamadanSummary] =
    useState(showRamadanSummary);

  useEffect(() => {
    if (showRamadanSummary) {
      setRenderRamadanSummary(true);
      ramadanSummaryAnim.setValue(0);
      Animated.timing(ramadanSummaryAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
      return;
    }

    if (!renderRamadanSummary) return;

    Animated.timing(ramadanSummaryAnim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) setRenderRamadanSummary(false);
    });
  }, [ramadanSummaryAnim, renderRamadanSummary, showRamadanSummary]);

  return {
    ramadanSummaryAnim,
    renderRamadanSummary,
  };
}
