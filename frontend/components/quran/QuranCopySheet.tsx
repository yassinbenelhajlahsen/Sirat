import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import PressableScale from "@/components/PressableScale";
import AppIcon, { type AppIconName } from "@/components/ui/AppIcon";
import SheetBackground from "@/components/ui/SheetBackground";
import SheetHeader from "@/components/ui/SheetHeader";
import { Callout } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useTabBarClearance } from "@/hooks/useTabBarClearance";
import { formatCopyText } from "@/services/quranCopyText";
import { NormalizedAyah } from "@/services/quranData";

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

  // Stays mounted through the close animation; only unmounts once the sheet
  // reports it has fully closed (onChange === -1), so closing animates instead
  // of snapping shut.
  const [mounted, setMounted] = useState(visible);
  const sheetRef = useRef<BottomSheet>(null);
  const previousVisibleRef = useRef(visible);

  // `visible` and `ayah` clear together on close, so keep the last ayah around
  // for the duration of the close animation.
  const lastAyahRef = useRef(ayah);
  if (ayah) {
    lastAyahRef.current = ayah;
  }
  const activeAyah = ayah ?? lastAyahRef.current;

  // The sheet runs full-height to the screen bottom, so its content is padded
  // past the floating glass tab bar.
  const tabBarClearance = useTabBarClearance();

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

  const enabledCount = [showArabic, showEnglish, showTransliteration].filter(
    Boolean,
  ).length;
  const showCopyAll = enabledCount > 1;

  if (!mounted || !activeAyah) {
    return null;
  }

  const title = `${activeAyah.surahNameEn} ${activeAyah.surahNumber}:${activeAyah.ayahNumber}`;

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      enableDynamicSizing
      enablePanDownToClose
      backgroundComponent={CopySheetBackground}
      handleIndicatorStyle={handleIndicatorStyle}
      onChange={handleSheetChange}
    >
      <BottomSheetView
        style={[styles.content, { paddingBottom: tabBarClearance + 24 }]}
      >
        <SheetHeader title={title} subtitle="Copy ayah text" onClose={onClose} />

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
                onCopy(
                  formatCopyText(activeAyah, {
                    arabic: true,
                    english: false,
                    transliteration: false,
                  }),
                )
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
                onCopy(
                  formatCopyText(activeAyah, {
                    arabic: false,
                    english: false,
                    transliteration: true,
                  }),
                )
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
                onCopy(
                  formatCopyText(activeAyah, {
                    arabic: false,
                    english: true,
                    transliteration: false,
                  }),
                )
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
                    formatCopyText(activeAyah, {
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
  icon: AppIconName;
  label: string;
  isLast: boolean;
  isGold: boolean;
  styles: ReturnType<typeof createStyles>;
  themeColors: AppTheme["colors"];
  onPress: () => void;
};

function CopyRow({
  icon,
  label,
  isLast,
  isGold,
  styles,
  themeColors,
  onPress,
}: CopyRowProps) {
  const labelColor = isGold ? themeColors.accent : themeColors.white;
  return (
    <PressableScale
      variant="row"
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.optionRow, isLast ? styles.optionRowLast : null]}
    >
      <View style={styles.optionIcon}>
        <AppIcon name={icon} size={20} color={themeColors.accent} />
      </View>
      <Callout color={labelColor}>{label}</Callout>
    </PressableScale>
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
    optionList: {
      marginTop: theme.spacing.xs,
    },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 48,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: isLight
        ? withOpacity(themeColors.primaryBorder, 0.5)
        : withOpacity(themeColors.white, 0.1),
    },
    optionRowLast: {
      borderBottomWidth: 0,
    },
    optionIcon: { width: 28, alignItems: "center", marginRight: theme.spacing.md },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: isLight
        ? withOpacity(themeColors.primaryBorder, 0.5)
        : withOpacity(themeColors.white, 0.1),
      marginVertical: theme.spacing.xs,
    },
  });
};
