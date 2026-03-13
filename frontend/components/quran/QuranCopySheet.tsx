import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
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
import { formatCopyText } from "@/services/quranCopyText";
import { NormalizedAyah } from "@/services/quranData";

import PressableScale from "../PressableScale";

type QuranCopySheetProps = {
  visible: boolean;
  ayah: NormalizedAyah | null;
  showArabic: boolean;
  showEnglish: boolean;
  showTransliteration: boolean;
  onCopy: (text: string) => void;
  onClose: () => void;
};

export default function QuranCopySheet({
  visible,
  ayah,
  showArabic,
  showEnglish,
  showTransliteration,
  onCopy,
  onClose,
}: QuranCopySheetProps) {
  const { theme } = useTheme();
  const themeColors = theme.colors;
  const isLight = theme.name === "light";
  const styles = useMemo(() => createStyles(theme), [theme]);

  const { shouldRender, overlayAnimatedStyle, cardAnimatedStyle } =
    useModalTransition(visible);

  const enabledCount = [showArabic, showEnglish, showTransliteration].filter(Boolean).length;
  const showCopyAll = enabledCount > 1;

  if (!shouldRender || !ayah) {
    return null;
  }

  const title = `${ayah.surahNameEn} ${ayah.surahNumber}:${ayah.ayahNumber}`;

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
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>{title}</Text>
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
          <Text style={styles.subtitle}>Copy ayah text</Text>

          <View style={styles.optionList}>
            {showArabic ? (
              <CopyRow
                icon="copy-outline"
                label="Copy Arabic"
                isLast={!showTransliteration && !showEnglish && !showCopyAll}
                styles={styles}
                themeColors={themeColors}
                onPress={() =>
                  onCopy(formatCopyText(ayah, { arabic: true, english: false, transliteration: false }))
                }
              />
            ) : null}

            {showTransliteration ? (
              <CopyRow
                icon="copy-outline"
                label="Copy Transliteration"
                isLast={!showEnglish && !showCopyAll}
                styles={styles}
                themeColors={themeColors}
                onPress={() =>
                  onCopy(formatCopyText(ayah, { arabic: false, english: false, transliteration: true }))
                }
              />
            ) : null}

            {showEnglish ? (
              <CopyRow
                icon="copy-outline"
                label="Copy English"
                isLast={!showCopyAll}
                styles={styles}
                themeColors={themeColors}
                onPress={() =>
                  onCopy(formatCopyText(ayah, { arabic: false, english: true, transliteration: false }))
                }
              />
            ) : null}

            {showCopyAll ? (
              <>
                <View style={styles.divider} />
                <CopyRow
                  icon="documents-outline"
                  label="Copy All"
                  isLast
                  styles={styles}
                  themeColors={themeColors}
                  onPress={() =>
                    onCopy(
                      formatCopyText(ayah, {
                        arabic: showArabic,
                        english: showEnglish,
                        transliteration: showTransliteration,
                      }),
                    )
                  }
                />
              </>
            ) : null}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

type CopyRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  isLast: boolean;
  styles: ReturnType<typeof createStyles>;
  themeColors: AppTheme["colors"];
  onPress: () => void;
};

function CopyRow({ icon, label, isLast, styles, themeColors, onPress }: CopyRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionRow,
        isLast ? styles.optionRowLast : null,
        pressed ? styles.optionRowPressed : null,
      ]}
    >
      <Ionicons name={icon} size={20} color={themeColors.accent} style={styles.optionIcon} />
      <Text style={styles.optionLabel}>{label}</Text>
    </Pressable>
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
        : withOpacity(themeColors.black, 0.5),
      justifyContent: "flex-end",
    },
    card: {
      backgroundColor: isLight
        ? withOpacity(themeColors.primaryLift, 0.98)
        : withOpacity(themeColors.primaryDeep, 0.97),
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 36,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 999,
      backgroundColor: isLight
        ? withOpacity(themeColors.grayDark, 0.2)
        : withOpacity(themeColors.white, 0.2),
      alignSelf: "center",
      marginBottom: 16,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    title: {
      color: isLight ? themeColors.offWhite : themeColors.white,
      fontSize: 17,
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
        : withOpacity(themeColors.white, 0.6),
      fontSize: 13,
      marginBottom: 14,
    },
    optionList: {
      marginTop: 4,
    },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 4,
      paddingVertical: 15,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: isLight
        ? withOpacity(themeColors.primaryBorder, 0.5)
        : withOpacity(themeColors.white, 0.08),
    },
    optionRowPressed: {
      opacity: 0.55,
    },
    optionRowLast: {
      borderBottomWidth: 0,
    },
    optionIcon: {
      marginRight: 12,
    },
    optionLabel: {
      color: isLight ? themeColors.offWhite : themeColors.white,
      fontSize: 16,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: isLight
        ? withOpacity(themeColors.primaryBorder, 0.5)
        : withOpacity(themeColors.white, 0.1),
      marginVertical: 4,
    },
  });
};
