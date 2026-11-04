import { useCallback, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import PressableScale from "@/components/PressableScale";
import AppIcon from "@/components/ui/AppIcon";
import NativeSheet from "@/components/ui/NativeSheet";
import SectionHeader from "@/components/ui/SectionHeader";
import { Body, Footnote } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useQuranDisplayModes } from "@/hooks/useQuranDisplayModes";
import { useQuranReciter } from "@/hooks/useQuranReciter";
import { useQuranTextScale } from "@/hooks/useQuranTextScale";
import { QURAN_RECITERS } from "@/services/quranAudio";
import { QuranDisplayMode } from "@/services/quranDisplayModes";
import {
  QURAN_TEXT_SCALE_LABELS,
  QURAN_TEXT_SCALE_OPTIONS,
} from "@/services/quranTextScale";

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
  const { reciterId, setReciterId } = useQuranReciter();
  const selectedDisplayModeCount = displayModes.length;

  const handleDisplayModePress = useCallback(
    (mode: QuranDisplayMode) => {
      void toggleDisplayMode(mode);
    },
    [toggleDisplayMode],
  );

  return (
    <NativeSheet visible={visible} onClose={onClose} title="Display Text">
      <View style={styles.content}>
        <Footnote color={themeColors.textSecondary} style={styles.hint}>
          Select which text to show
        </Footnote>
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

        <View style={styles.sectionLabel}>
          <SectionHeader title="Reciter" />
        </View>
        <ScrollView style={styles.reciterList} nestedScrollEnabled accessibilityRole="radiogroup">
          {QURAN_RECITERS.map((reciter, index) => {
            const selected = reciter.id === reciterId;
            return (
              <PressableScale
                key={reciter.id}
                variant="row"
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, selected }}
                onPress={() => void setReciterId(reciter.id)}
                style={[
                  styles.displayModeRow,
                  index > 0 ? styles.displayModeRowSeparated : null,
                ]}
              >
                <Body color={themeColors.white} style={styles.displayModeLabel}>
                  {reciter.name}
                </Body>
                {selected ? (
                  <AppIcon name="checkmark" size={18} color={themeColors.accent} />
                ) : null}
              </PressableScale>
            );
          })}
        </ScrollView>
      </View>
    </NativeSheet>
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
    hint: { marginBottom: theme.spacing.md },
    displayModeList: {
      borderRadius: theme.radii.row,
      borderCurve: "continuous",
      overflow: "hidden",
      backgroundColor: isLight
        ? withOpacity(themeColors.black, 0.05)
        : withOpacity(themeColors.white, 0.07),
    },
    reciterList: {
      // Caps the sheet height so 8 rows don't overflow small phones; the half row hints at scrolling.
      maxHeight: 264,
      borderRadius: theme.radii.row,
      borderCurve: "continuous",
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
