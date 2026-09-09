import { useMemo, useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, View } from "react-native";

import { Footnote } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

export type SegmentedOption<T extends string | number> = {
  value: T;
  label: string;
  accessibilityLabel?: string;
};

type Props<T extends string | number> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  testID?: string;
};

const PAD = 2;
const HEIGHT = 32;

/** The iOS segmented control: a track fill with a sliding thumb, no borders. */
export default function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  accessibilityLabel,
  disabled = false,
  testID,
}: Props<T>) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [trackWidth, setTrackWidth] = useState(0);

  const count = options.length || 1;
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segmentWidth = trackWidth > 0 ? (trackWidth - PAD * 2) / count : 0;

  const onLayout = (event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width);

  return (
    <View
      style={[styles.track, disabled && styles.disabled]}
      onLayout={onLayout}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {segmentWidth > 0 ? (
        <View
          pointerEvents="none"
          testID={testID ? `${testID}-thumb` : undefined}
          style={[styles.thumb, { width: segmentWidth, left: PAD + index * segmentWidth }]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            style={styles.segment}
          >
            <Footnote
              numberOfLines={1}
              color={selected ? theme.colors.white : theme.colors.textSecondary}
              style={styles.label}
            >
              {option.label}
            </Footnote>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    track: {
      flexDirection: "row",
      alignItems: "center",
      height: HEIGHT,
      padding: PAD,
      borderRadius: theme.radii.chip,
      borderCurve: "continuous",
      backgroundColor: withOpacity(theme.colors.white, 0.08),
    },
    thumb: {
      position: "absolute",
      top: PAD,
      bottom: PAD,
      borderRadius: theme.radii.chip - PAD,
      borderCurve: "continuous",
      backgroundColor: withOpacity(theme.colors.white, 0.16),
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
    },
    segment: {
      flex: 1,
      minHeight: HEIGHT - PAD * 2,
      alignItems: "center",
      justifyContent: "center",
    },
    label: { fontWeight: "600" },
    disabled: { opacity: 0.45 },
  });
