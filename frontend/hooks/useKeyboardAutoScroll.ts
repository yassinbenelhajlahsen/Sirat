import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Platform, ScrollView } from "react-native";

export function useKeyboardAutoScroll() {
  const scrollViewRef = useRef<ScrollView>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const scrollToBottom = useCallback((animated: boolean) => {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const handleContentSizeChange = useCallback(() => {
    if (keyboardOpen) scrollToBottom(false);
  }, [keyboardOpen, scrollToBottom]);

  useEffect(() => {
    const willShowSub =
      Platform.OS === "ios"
        ? Keyboard.addListener("keyboardWillShow", () => {
            setKeyboardOpen(true);
            requestAnimationFrame(() => scrollToBottom(true));
          })
        : null;

    const didShowSub = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardOpen(true);
      requestAnimationFrame(() => scrollToBottom(false));
    });

    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardOpen(false);
    });

    return () => {
      willShowSub?.remove();
      didShowSub.remove();
      hideSub.remove();
    };
  }, [scrollToBottom]);

  return {
    scrollViewRef,
    scrollToBottom,
    handleContentSizeChange,
  };
}
