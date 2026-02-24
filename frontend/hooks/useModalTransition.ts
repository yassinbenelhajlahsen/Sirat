import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing } from "react-native";

const EXIT_DURATION_MS = 170;
const ENTER_SPRING_SPEED = 15;
const ENTER_SPRING_BOUNCINESS = 10;

export default function useModalTransition(visible: boolean) {
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [shouldRender, setShouldRender] = useState(visible);

  useEffect(() => {
    progress.stopAnimation();

    if (visible) {
      setShouldRender(true);
      progress.setValue(0);
      Animated.spring(progress, {
        toValue: 1,
        speed: ENTER_SPRING_SPEED,
        bounciness: ENTER_SPRING_BOUNCINESS,
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(progress, {
      toValue: 0,
      duration: EXIT_DURATION_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setShouldRender(false);
      }
    });
  }, [progress, visible]);

  const overlayAnimatedStyle = useMemo(
    () => ({
      opacity: progress,
    }),
    [progress],
  );

  const cardAnimatedStyle = useMemo(
    () => ({
      opacity: progress,
      transform: [
        {
          translateY: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [14, 0],
          }),
        },
        {
          scale: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.96, 1],
          }),
        },
      ],
    }),
    [progress],
  );

  return {
    shouldRender,
    overlayAnimatedStyle,
    cardAnimatedStyle,
  };
}
