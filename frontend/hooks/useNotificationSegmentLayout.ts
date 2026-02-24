import { useCallback, useMemo, useState } from "react";
import { Animated, type LayoutChangeEvent } from "react-native";

type Params = {
  soundIndicator: Animated.Value;
  optionCount: number;
  gap: number;
};

export function useNotificationSegmentLayout({
  soundIndicator,
  optionCount,
  gap,
}: Params) {
  const [segmentWidth, setSegmentWidth] = useState<number | null>(null);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const width = event.nativeEvent.layout.width;
      if (!width) return;

      const calculated = (width - gap * (optionCount - 1)) / optionCount;
      if (!Number.isFinite(calculated) || calculated <= 0) return;
      if (segmentWidth != null && Math.abs(segmentWidth - calculated) < 0.5) {
        return;
      }

      setSegmentWidth(calculated);
    },
    [gap, optionCount, segmentWidth],
  );

  const indicatorTranslateX = useMemo(() => {
    if (segmentWidth == null) return null;

    return soundIndicator.interpolate({
      inputRange: [0, 1],
      outputRange: [0, segmentWidth + gap],
    });
  }, [gap, segmentWidth, soundIndicator]);

  return {
    segmentWidth,
    indicatorTranslateX,
    onLayout,
  };
}
