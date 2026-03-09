import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, KeyboardEvent, LayoutChangeEvent, Platform, ScrollView } from "react-native";

export function useKeyboardAutoScroll() {
  const scrollViewRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const duaSectionLayout = useRef<{ y: number; height: number } | null>(null);
  const scrollViewHeight = useRef(0);

  const onDuaSectionLayout = useCallback((event: LayoutChangeEvent) => {
    duaSectionLayout.current = {
      y: event.nativeEvent.layout.y,
      height: event.nativeEvent.layout.height,
    };
  }, []);

  const onScrollViewLayout = useCallback((event: LayoutChangeEvent) => {
    scrollViewHeight.current = event.nativeEvent.layout.height;
  }, []);

  useEffect(() => {
    const onShow = (e: KeyboardEvent) => {
      setKeyboardHeight(e.endCoordinates.height);
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      });
    };

    const onHide = () => {
      const layout = duaSectionLayout.current;
      const viewportH = scrollViewHeight.current;
      if (layout && viewportH > 0) {
        const targetY = Math.max(0, layout.y + layout.height - viewportH + 20);
        // Scroll to target while padding is still present, then remove padding
        // after the animation so there's no snap.
        scrollViewRef.current?.scrollTo({ y: targetY + 40, animated: true });
        setTimeout(() => setKeyboardHeight(0), 350);
      } else {
        setKeyboardHeight(0);
      }
    };

    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      onShow,
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      onHide,
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return {
    scrollViewRef,
    keyboardHeight,
    onDuaSectionLayout,
    onScrollViewLayout,
  };
}
