import { type ThemeName } from "@/constants/theme";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing } from "react-native";
import CALCULATION_METHODS from "../utils/calculationMethods";

export function useSettingsDropdowns(useLocation: boolean) {
  const [methodOpen, setMethodOpen] = useState(false);
  const [methodItems, setMethodItems] = useState(
    CALCULATION_METHODS.map((m) => ({ label: m.name, value: m.id })),
  );
  const [themeOpen, setThemeOpen] = useState(false);
  const [themeItems, setThemeItems] = useState([
    { label: "Default", value: "default" as ThemeName },
    { label: "Dark", value: "dark" as ThemeName },
    { label: "Light", value: "light" as ThemeName },
  ]);

  const methodAnim = useRef(new Animated.Value(0)).current;
  const themeAnim = useRef(new Animated.Value(0)).current;
  const locationAnim = useRef(new Animated.Value(useLocation ? 0 : 1)).current;
  const toggleScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(methodAnim, {
      toValue: methodOpen ? 1 : 0,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [methodAnim, methodOpen]);

  useEffect(() => {
    Animated.timing(themeAnim, {
      toValue: themeOpen ? 1 : 0,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [themeAnim, themeOpen]);

  useEffect(() => {
    Animated.timing(locationAnim, {
      toValue: useLocation ? 0 : 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [locationAnim, useLocation]);

  const methodScaleStyle = useMemo(
    () => ({
      transform: [
        {
          scale: methodAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.03],
          }),
        },
      ],
    }),
    [methodAnim],
  );

  const themeScaleStyle = useMemo(
    () => ({
      transform: [
        {
          scale: themeAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.03],
          }),
        },
      ],
    }),
    [themeAnim],
  );

  return {
    methodOpen,
    setMethodOpen,
    methodItems,
    setMethodItems,
    themeOpen,
    setThemeOpen,
    themeItems,
    setThemeItems,
    methodScaleStyle,
    themeScaleStyle,
    locationAnim,
    toggleScale,
  };
}
