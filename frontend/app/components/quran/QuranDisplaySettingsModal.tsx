import { Ionicons } from "@expo/vector-icons";
import { useCallback } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors as themeColors, withOpacity } from "@/constants/theme";
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
  const { displayModes, isModeEnabled, toggleDisplayMode } =
    useQuranDisplayModes();
  const selectedDisplayModeCount = displayModes.length;

  const handleDisplayModePress = useCallback(
    (mode: QuranDisplayMode) => {
      void toggleDisplayMode(mode);
    },
    [toggleDisplayMode]
  );

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Display Text</Text>
            <PressableScale
              accessibilityRole="button"
              onPress={onClose}
              style={styles.dismissButton}
              scaleTo={0.85}
            >
              <Ionicons name="close" size={18} color={themeColors.white} />
            </PressableScale>
          </View>
          <Text style={styles.subtitle}>
            Select which text to show
          </Text>
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
                    pressed && !isDisabled ? styles.displayModeRowPressed : null,
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
                        color={themeColors.primaryDeep}
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: withOpacity(themeColors.black, 0.45),
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: withOpacity(themeColors.primaryDeep, 0.95),
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: withOpacity(themeColors.accent, 0.5),
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  title: {
    color: themeColors.white,
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
    color: withOpacity(themeColors.white, 0.78),
    fontSize: 13,
    marginBottom: 12,
  },
  displayModeList: {
    borderWidth: 1,
    borderColor: withOpacity(themeColors.accent, 0.35),
    borderRadius: 12,
    overflow: "hidden",
  },
  displayModeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: withOpacity(themeColors.primaryDeep, 0.35),
    borderBottomWidth: 1,
    borderBottomColor: withOpacity(themeColors.accent, 0.2),
  },
  displayModeRowPressed: {
    backgroundColor: withOpacity(themeColors.primaryDeep, 0.55),
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
    borderColor: withOpacity(themeColors.white, 0.55),
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
    color: themeColors.white,
    fontSize: 15,
    fontFamily: "SFProDisplay-Regular",
  },
  displayModeLabelDisabled: {
    opacity: 0.9,
  },
});
