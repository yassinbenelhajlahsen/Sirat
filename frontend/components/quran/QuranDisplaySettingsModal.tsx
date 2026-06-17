import { Ionicons } from "@expo/vector-icons";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import SheetBackground from "@/components/ui/SheetBackground";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
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

const SNAP_POINTS = ["40%"];

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

  const sheetRef = useRef<BottomSheet>(null);
  const previousVisibleRef = useRef(visible);

  useEffect(() => {
    if (visible && !previousVisibleRef.current) {
      sheetRef.current?.snapToIndex(0);
    } else if (!visible && previousVisibleRef.current) {
      sheetRef.current?.close();
    }
    previousVisibleRef.current = visible;
  }, [visible]);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) {
        onClose();
      }
    },
    [onClose],
  );

  const handleIndicatorStyle = useMemo(
    () => ({
      backgroundColor: withOpacity(themeColors.white, 0.3),
      width: 38,
    }),
    [themeColors.white],
  );

  const handleDisplayModePress = useCallback(
    (mode: QuranDisplayMode) => {
      void toggleDisplayMode(mode);
    },
    [toggleDisplayMode],
  );

  if (!visible) {
    return null;
  }

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose
      backgroundComponent={SheetBackground}
      handleIndicatorStyle={handleIndicatorStyle}
      onChange={handleSheetChange}
    >
      <BottomSheetView style={styles.content}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Display Text</Text>
            <Text style={styles.subtitle}>Select which text to show</Text>
          </View>
          <PressableScale
            accessibilityRole="button"
            onPress={onClose}
            style={styles.dismissButton}
            scaleTo={0.85}
          >
            <View style={styles.dismissIcon}>
              <View style={[styles.dismissLine, styles.dismissLineFirst]} />
              <View style={[styles.dismissLine, styles.dismissLineSecond]} />
            </View>
          </PressableScale>
        </View>

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
      </BottomSheetView>
    </BottomSheet>
  );
}

const createStyles = (theme: AppTheme) => {
  const themeColors = theme.colors;
  const isLight = theme.name === "light";

  return StyleSheet.create({
    content: {
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      paddingTop: 18,
      marginBottom: 16,
    },
    title: {
      color: isLight ? themeColors.offWhite : themeColors.white,
      fontSize: 20,
      fontWeight: "700",
    },
    subtitle: {
      marginTop: 4,
      color: isLight
        ? withOpacity(themeColors.grayDark, 0.95)
        : withOpacity(themeColors.white, 0.66),
      fontSize: 12,
      letterSpacing: 0.3,
    },
    dismissButton: {
      padding: 8,
      marginTop: -2,
      borderRadius: 999,
      backgroundColor: isLight
        ? withOpacity(themeColors.primarySurfaceAlt, 0.55)
        : withOpacity(themeColors.white, 0.08),
      borderWidth: 1,
      borderColor: isLight
        ? withOpacity(themeColors.primaryBorder, 0.7)
        : withOpacity(themeColors.white, 0.12),
    },
    dismissIcon: {
      width: 18,
      height: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    dismissLine: {
      position: "absolute",
      width: 18,
      height: 2,
      backgroundColor: isLight ? themeColors.offWhite : themeColors.white,
      borderRadius: 999,
    },
    dismissLineFirst: {
      transform: [{ rotate: "45deg" }],
    },
    dismissLineSecond: {
      transform: [{ rotate: "-45deg" }],
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
