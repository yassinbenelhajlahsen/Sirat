import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaFrame } from "react-native-safe-area-context";

import PressableScale from "@/components/PressableScale";
import AppIcon from "@/components/ui/AppIcon";
import SectionHeader from "@/components/ui/SectionHeader";
import SheetBackground from "@/components/ui/SheetBackground";
import SheetHeader from "@/components/ui/SheetHeader";
import { Body } from "@/components/ui/Text";
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

            return (
              <PressableScale
                key={option.mode}
                variant="row"
                accessibilityRole="checkbox"
                accessibilityState={{ checked, disabled: isDisabled }}
                accessibilityHint={isDisabled ? "At least one text must stay on" : undefined}
                onPress={() => {
                  if (!isDisabled) {
                    handleDisplayModePress(option.mode);
                  }
                }}
                style={[
                  styles.displayModeRow,
                  index > 0 ? styles.displayModeRowSeparated : null,
                  isDisabled ? styles.displayModeRowDisabled : null,
                ]}
              >
                <Body color={themeColors.white} style={styles.displayModeLabel}>
                  {option.label}
                </Body>
                {checked ? (
                  <AppIcon name="checkmark" size={18} color={themeColors.accent} />
                ) : null}
              </PressableScale>
            );
          })}
        </View>

        <View style={styles.sectionLabel}>
          <SectionHeader title="Text size" />
        </View>
        {/* The Segmented track, but with size-varying "A" glyphs for labels. */}
        <View style={styles.scaleRow} accessibilityRole="radiogroup">
          {QURAN_TEXT_SCALE_OPTIONS.map((option) => {
            const selected = textScale === option;
            return (
              <PressableScale
                key={option}
                variant="button"
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, selected }}
                accessibilityLabel={`${QURAN_TEXT_SCALE_LABELS[option]} text`}
                onPress={() => void setTextScale(option)}
                style={[styles.scaleCell, selected ? styles.scaleCellSelected : null]}
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
              </PressableScale>
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
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: theme.spacing.xxl,
    },
    displayModeList: {
      borderRadius: theme.radii.row,
      borderCurve: "continuous",
      overflow: "hidden",
      backgroundColor: isLight
        ? withOpacity(themeColors.black, 0.05)
        : withOpacity(themeColors.white, 0.07),
    },
    displayModeRow: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 48,
      paddingHorizontal: theme.spacing.lg,
    },
    displayModeRowSeparated: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: withOpacity(themeColors.white, 0.1),
    },
    displayModeRowDisabled: {
      opacity: 0.72,
    },
    displayModeLabel: { flex: 1 },
    sectionLabel: {
      marginTop: theme.spacing.xxl,
    },
    scaleRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: 2,
      gap: 2,
      borderRadius: theme.radii.chip,
      borderCurve: "continuous",
      backgroundColor: withOpacity(themeColors.white, 0.08),
    },
    scaleCell: {
      flex: 1,
      minHeight: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radii.chip - 2,
      borderCurve: "continuous",
    },
    scaleCellSelected: {
      backgroundColor: themeColors.accent,
    },
    scaleGlyph: {
      fontWeight: "600",
    },
  });
};
