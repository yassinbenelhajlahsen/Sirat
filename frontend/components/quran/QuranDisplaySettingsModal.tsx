import { Ionicons } from "@expo/vector-icons";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaFrame } from "react-native-safe-area-context";

import SheetBackground from "@/components/ui/SheetBackground";
import SheetHeader from "@/components/ui/SheetHeader";
import { Caption, Subhead } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useQuranDisplayModes } from "@/hooks/useQuranDisplayModes";
import { useQuranTextScale } from "@/hooks/useQuranTextScale";
import { QuranDisplayMode } from "@/services/quranDisplayModes";
import {
  QURAN_TEXT_SCALE_LABELS,
  QURAN_TEXT_SCALE_OPTIONS,
} from "@/services/quranTextScale";

function DisplaySettingsSheetBackground(p: Parameters<typeof SheetBackground>[0]) {
  return <SheetBackground {...p} solid />;
}

// Header + three checkboxes + text-size row. gorhom 5.2 + reanimated 4 doesn't
// bound content to the snap height, so the content host is capped to match.
const SNAP_FRACTION = 0.5;
const SNAP_POINTS = [`${SNAP_FRACTION * 100}%`];

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
  const styles = useMemo(() => createStyles(theme), [theme]);

  const { displayModes, isModeEnabled, toggleDisplayMode } =
    useQuranDisplayModes();
  const { textScale, setTextScale } = useQuranTextScale();
  const selectedDisplayModeCount = displayModes.length;
  const frame = useSafeAreaFrame();
  const contentMaxHeight = Math.round(frame.height * SNAP_FRACTION);

  // Stays mounted through the close animation; only unmounts once the sheet
  // reports it has fully closed (onChange === -1), so closing animates instead
  // of snapping shut.
  const [mounted, setMounted] = useState(visible);
  const sheetRef = useRef<BottomSheet>(null);
  const previousVisibleRef = useRef(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
    }
  }, [visible]);

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
        setMounted(false);
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

  if (!mounted) {
    return null;
  }

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={SNAP_POINTS}
      enableDynamicSizing={false}
      enablePanDownToClose
      backgroundComponent={DisplaySettingsSheetBackground}
      handleIndicatorStyle={handleIndicatorStyle}
      onChange={handleSheetChange}
    >
      <BottomSheetView style={[styles.content, { maxHeight: contentMaxHeight }]}>
        <SheetHeader title="Display Text" subtitle="Select which text to show" onClose={onClose} />

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
                accessibilityHint={isDisabled ? "At least one text must stay on" : undefined}
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
                <Subhead color={themeColors.white}>{option.label}</Subhead>
              </Pressable>
            );
          })}
        </View>

        <Caption color={themeColors.textTertiary} style={styles.sectionLabel}>
          TEXT SIZE
        </Caption>
        <View style={styles.scaleRow} accessibilityRole="radiogroup">
          {QURAN_TEXT_SCALE_OPTIONS.map((option) => {
            const selected = textScale === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, selected }}
                accessibilityLabel={`${QURAN_TEXT_SCALE_LABELS[option]} text`}
                onPress={() => void setTextScale(option)}
                style={({ pressed }) => [
                  styles.scaleCell,
                  selected ? styles.scaleCellSelected : null,
                  pressed && !selected ? styles.scaleCellPressed : null,
                ]}
              >
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.scaleGlyph,
                    {
                      fontSize: 13 + option * 6,
                      color: selected ? themeColors.onAccent : themeColors.white,
                    },
                  ]}
                >
                  A
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
      minHeight: 48,
      paddingHorizontal: 14,
      paddingVertical: 10,
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
    sectionLabel: {
      letterSpacing: 1,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
    },
    scaleRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    scaleCell: {
      flex: 1,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radii.row,
      borderCurve: "continuous",
      borderWidth: 1,
      borderColor: withOpacity(themeColors.white, 0.12),
      backgroundColor: withOpacity(themeColors.white, 0.05),
    },
    scaleCellSelected: {
      backgroundColor: themeColors.accent,
      borderColor: themeColors.accent,
    },
    scaleCellPressed: {
      backgroundColor: withOpacity(themeColors.white, 0.1),
    },
    scaleGlyph: {
      fontWeight: "600",
    },
  });
};
