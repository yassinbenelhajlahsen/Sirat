import { type MutableRefObject, useEffect, useRef, useState } from "react";
import { Animated, Easing, PanResponder } from "react-native";

export function useCalendarNavigationTransitions({
  viewYear,
  viewMonth,
  setViewYear,
  setViewMonth,
  viewYearRef,
  viewMonthRef,
  minDate,
  maxDate,
  today,
  screenWidth,
  initialIsViewingToday,
  isViewingToday,
}: {
  viewYear: number;
  viewMonth: number;
  setViewYear: (value: number) => void;
  setViewMonth: (value: number) => void;
  viewYearRef: MutableRefObject<number>;
  viewMonthRef: MutableRefObject<number>;
  minDate: Date;
  maxDate: Date;
  today: Date;
  screenWidth: number;
  initialIsViewingToday: boolean;
  isViewingToday: boolean;
}) {
  const [navigating, setNavigating] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const backToTodayAnim = useRef(
    new Animated.Value(initialIsViewingToday ? 0 : 1),
  ).current;

  useEffect(() => {
    Animated.timing(backToTodayAnim, {
      toValue: isViewingToday ? 0 : 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [backToTodayAnim, isViewingToday]);

  const animateSlideChange = (
    dir: 1 | -1,
    targetYear: number,
    targetMonth: number,
  ) => {
    if (navigating) return;
    setNavigating(true);

    Animated.parallel([
      Animated.timing(translateX, {
        toValue: -dir * screenWidth,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0.9,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setViewYear(targetYear);
      setViewMonth(targetMonth);

      translateX.setValue(dir * screenWidth);
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setNavigating(false);
      });
    });
  };

  const goToPreviousMonth = () => {
    const prev = new Date(viewYear, viewMonth - 1);
    if (prev >= minDate) {
      animateSlideChange(-1, prev.getFullYear(), prev.getMonth());
    }
  };

  const goToNextMonth = () => {
    const next = new Date(viewYear, viewMonth + 1);
    if (next <= maxDate) {
      animateSlideChange(1, next.getFullYear(), next.getMonth());
    }
  };

  const goBackToToday = () => {
    const targetYear = today.getFullYear();
    const targetMonth = today.getMonth();
    if (targetYear === viewYear && targetMonth === viewMonth) return;

    const targetDate = new Date(targetYear, targetMonth);
    const currentDate = new Date(viewYear, viewMonth);
    const dir: 1 | -1 = targetDate > currentDate ? 1 : -1;
    animateSlideChange(dir, targetYear, targetMonth);
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 8 && Math.abs(gestureState.dy) < 20,
      onPanResponderGrant: () => {
        translateX.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(gestureState.dx);
        const fade =
          1 - Math.min(Math.abs(gestureState.dx) / screenWidth, 0.25);
        fadeAnim.setValue(fade);
      },
      onPanResponderRelease: (_, gestureState) => {
        const dx = gestureState.dx;
        const vx = gestureState.vx;
        const threshold = Math.min(0.25 * screenWidth, 80);

        if (dx < -threshold || (vx < -0.8 && Math.abs(dx) > 20)) {
          const next = new Date(viewYearRef.current, viewMonthRef.current + 1);
          if (next <= maxDate) {
            animateSlideChange(1, next.getFullYear(), next.getMonth());
            return;
          }
        } else if (dx > threshold || (vx > 0.8 && Math.abs(dx) > 20)) {
          const prev = new Date(viewYearRef.current, viewMonthRef.current - 1);
          if (prev >= minDate) {
            animateSlideChange(-1, prev.getFullYear(), prev.getMonth());
            return;
          }
        }

        Animated.parallel([
          Animated.timing(translateX, {
            toValue: 0,
            duration: 180,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 160,
            useNativeDriver: true,
          }),
        ]).start();
      },
      onPanResponderTerminate: () => {
        Animated.timing(translateX, {
          toValue: 0,
          duration: 160,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 140,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  return {
    navigating,
    setNavigating,
    fadeAnim,
    translateX,
    backToTodayAnim,
    panHandlers: panResponder.panHandlers,
    animateSlideChange,
    goToPreviousMonth,
    goToNextMonth,
    goBackToToday,
  };
}
