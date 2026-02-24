import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import useModalTransition from "@/hooks/useModalTransition";
import { useQuranDisplayModes } from "@/hooks/useQuranDisplayModes";
import { QuranDisplayMode } from "@/services/quranDisplayModes";

import PressableScale from "../PressableScale";

type QuranDisplaySettingsModalProps = {
  visible: boolean;
  onClose: () => void;
};

const DISPLAY_MODE_OPTIONS: readonly {
  mode: QuranDisplayMode;
  label: string;
}[] = [
  { mode: "arabic", label: "Arabic" },
  { mode: "english", label: "English" },
  { mode: "transliteration", label: "Transliteration" },
];

export default function QuranDisplaySettingsModal({
  visible,
  onClose,
}: QuranDisplaySettingsModalProps) {
  const { theme } = useTheme();
  const themeColors = theme.colors;
  const isLight = theme.name === "light";
  const styles = useMemo(() => createStyles(theme), [theme]);

  const { displayModes, isModeEnabled, toggleDisplayMode } =
    useQuranDisplayModes();
  const selectedDisplayModeCount = displayModes.length;
  const { shouldRender, overlayAnimatedStyle, cardAnimatedStyle } =
    useModalTransition(visible);

  const handleDisplayModePress = useCallback(
    (mode: QuranDisplayMode) => {
      void toggleDisplayMode(mode);
    },
    [toggleDisplayMode],
  );

  if (!shouldRender) {
    return null;
  }

  return (
    <Modal
      animationType="none"
      transparent
      visible={shouldRender}
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, overlayAnimatedStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.card, cardAnimatedStyle]}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Display Text</Text>
            <PressableScale
              accessibilityRole="button"
              onPress={onClose}
              style={styles.dismissButton}
              scaleTo={0.85}
            >
              <Ionicons
                name="close"
                size={18}
                color={isLight ? themeColors.offWhite : themeColors.white}
              />
            </PressableScale>
          </View>
          <Text style={styles.subtitle}>Select which text to show</Text>
          <View style={styles.displayModeList}>
            {DISPLAY_MODE_OPTIONS.map((option, index) => {
              const checked = isModeEnabled(option.mode);
              const isDisabled = checked && selectedDisplayModeCount === 1;
              const isLast = index === DISPLAY_MODE_OPTIONS.length - 1;

              return (
                <Pressable
                  key={option.mode}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked, disabled: isDisabled }}
                  onPress={() => {
                    if (!isDisabled) {
                      handleDisplayModePress(option.mode);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.displayModeRow,
                    isLast ? styles.displayModeRowLast : null,
                    pressed && !isDisabled
                      ? styles.displayModeRowPressed
                      : null,
                    isDisabled ? styles.displayModeRowDisabled : null,
                  ]}
                >
                  <View
                    style={[
                      styles.displayModeCheckbox,
                      checked ? styles.displayModeCheckboxChecked : null,
                    ]}
                  >
                    {checked ? (
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={themeColors.onAccent}
                      />
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.displayModeLabel,
                      isDisabled ? styles.displayModeLabelDisabled : null,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const createStyles = (theme: AppTheme) => {
  const themeColors = theme.colors;
  const isLight = theme.name === "light";

  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: isLight
        ? withOpacity(themeColors.black, 0.28)
        : withOpacity(themeColors.black, 0.45),
      justifyContent: "center",
      paddingHorizontal: 20,
    },
    card: {
      backgroundColor: isLight
        ? withOpacity(themeColors.primaryLift, 0.98)
        : withOpacity(themeColors.primaryDeep, 0.95),
      borderRadius: 20,
      paddingHorizontal: 20,
      paddingVertical: 20,
      borderWidth: 1,
      borderColor: isLight
        ? withOpacity(themeColors.primaryBorder, 0.8)
        : withOpacity(themeColors.accent, 0.5),
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    title: {
      color: isLight ? themeColors.offWhite : themeColors.white,
      fontSize: 20,
      fontWeight: "700",
    },
    dismissButton: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    subtitle: {
      color: isLight
        ? withOpacity(themeColors.grayDark, 0.95)
        : withOpacity(themeColors.white, 0.78),
      fontSize: 13,
      marginBottom: 12,
    },
    displayModeList: {
      borderWidth: 1,
      borderColor: isLight
        ? withOpacity(themeColors.primaryBorder, 0.66)
        : withOpacity(themeColors.accent, 0.35),
      borderRadius: 12,
      overflow: "hidden",
    },
    displayModeRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: isLight
        ? withOpacity(themeColors.primarySurface, 0.9)
        : withOpacity(themeColors.primaryDeep, 0.35),
      borderBottomWidth: 1,
      borderBottomColor: isLight
        ? withOpacity(themeColors.primaryBorder, 0.4)
        : withOpacity(themeColors.accent, 0.2),
    },
    displayModeRowPressed: {
      backgroundColor: isLight
        ? withOpacity(themeColors.primarySurfaceAlt, 0.62)
        : withOpacity(themeColors.primaryDeep, 0.55),
    },
    displayModeRowLast: {
      borderBottomWidth: 0,
    },
    displayModeRowDisabled: {
      opacity: 0.72,
    },
    displayModeCheckbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: isLight
        ? withOpacity(themeColors.primaryOutline, 0.88)
        : withOpacity(themeColors.white, 0.55),
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
      backgroundColor: "transparent",
    },
    displayModeCheckboxChecked: {
      backgroundColor: themeColors.accent,
      borderColor: themeColors.accent,
    },
    displayModeLabel: {
      color: isLight ? themeColors.offWhite : themeColors.white,
      fontSize: 15,
      fontFamily: "SFProDisplay-Regular",
    },
    displayModeLabelDisabled: {
      opacity: 0.9,
    },
  });
};
