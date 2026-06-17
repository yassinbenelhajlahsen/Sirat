import { Ionicons } from "@expo/vector-icons";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import SheetBackground from "@/components/ui/SheetBackground";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { formatCopyText } from "@/services/quranCopyText";
import { NormalizedAyah } from "@/services/quranData";

import PressableScale from "../PressableScale";

function CopySheetBackground(p: Parameters<typeof SheetBackground>[0]) {
  return <SheetBackground {...p} solid />;
}

type QuranCopySheetProps = {
  visible: boolean;
  ayah: NormalizedAyah | null;
  showArabic: boolean;
  showEnglish: boolean;
  showTransliteration: boolean;
  onCopy: (text: string) => void;
  onClose: () => void;
};

const SNAP_POINTS = ["40%"];

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
  const styles = useMemo(() => createStyles(theme), [theme]);

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

  const enabledCount = [showArabic, showEnglish, showTransliteration].filter(Boolean).length;
  const showCopyAll = enabledCount > 1;

  if (!visible || !ayah) {
    return null;
  }

  const title = `${ayah.surahNameEn} ${ayah.surahNumber}:${ayah.ayahNumber}`;

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose
      backgroundComponent={CopySheetBackground}
      handleIndicatorStyle={handleIndicatorStyle}
      onChange={handleSheetChange}
    >
      <BottomSheetView style={styles.content}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>Copy ayah text</Text>
          </View>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Close"
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

        <View style={styles.optionList}>
          {showArabic ? (
            <CopyRow
              icon="copy-outline"
              label="Copy Arabic"
              isLast={!showTransliteration && !showEnglish && !showCopyAll}
              isGold={false}
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
              isGold={false}
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
              isGold={false}
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
                isGold
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
      </BottomSheetView>
    </BottomSheet>
  );
}

type CopyRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  isLast: boolean;
  isGold: boolean;
  styles: ReturnType<typeof createStyles>;
  themeColors: AppTheme["colors"];
  onPress: () => void;
};

function CopyRow({ icon, label, isLast, isGold, styles, themeColors, onPress }: CopyRowProps) {
  const labelColor = isGold ? themeColors.accent : themeColors.white;
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
      <Text style={[styles.optionLabel, { color: labelColor }]}>{label}</Text>
    </Pressable>
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
      fontSize: 17,
      fontWeight: "700",
    },
    subtitle: {
      marginTop: 4,
      color: isLight
        ? withOpacity(themeColors.grayDark, 0.95)
        : withOpacity(themeColors.white, 0.6),
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
