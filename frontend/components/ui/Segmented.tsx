import { Host, Picker, Text } from "@expo/ui/swift-ui";
import { accessibilityLabel as a11yLabel, pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";
import { StyleSheet, View } from "react-native";

export type SegmentedOption<T extends string | number> = {
  value: T;
  label: string;
  accessibilityLabel?: string;
};

type SegmentedProps<T extends string | number> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  testID?: string;
};

const SEGMENTED = [pickerStyle("segmented")];

/** The system iOS segmented control. The wrapper View carries the accessibility group. */
export default function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  accessibilityLabel,
  disabled = false,
  testID,
}: SegmentedProps<T>) {
  return (
    <View
      style={disabled ? styles.disabled : undefined}
      pointerEvents={disabled ? "none" : "auto"}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {/* Laid out below the fold, the host sat inside the home-indicator inset and SwiftUI
          shifted the picker up; scrolling never re-applied the inset until a re-render. */}
      <Host style={styles.host} ignoreSafeArea="all">
        <Picker selection={value} onSelectionChange={onChange} modifiers={SEGMENTED}>
          {options.map((option) => (
            <Text
              key={String(option.value)}
              modifiers={[
                tag(option.value),
                ...(option.accessibilityLabel ? [a11yLabel(option.accessibilityLabel)] : []),
              ]}
            >
              {option.label}
            </Text>
          ))}
        </Picker>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  // Fixed at the system control height.
  host: { width: "100%", height: 32 },
  disabled: { opacity: 0.45 },
});
