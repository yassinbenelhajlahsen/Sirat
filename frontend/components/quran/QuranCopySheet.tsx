import { useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";

import PressableScale from "@/components/PressableScale";
import AppIcon, { type AppIconName } from "@/components/ui/AppIcon";
import NativeSheet from "@/components/ui/NativeSheet";
import { Callout } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { formatCopyText } from "@/services/quranCopyText";
import { NormalizedAyah } from "@/services/quranData";

type QuranCopySheetProps = {
  visible: boolean;
  ayah: NormalizedAyah | null;
  showArabic: boolean;
  showEnglish: boolean;
  showTransliteration: boolean;
  onCopy: (text: string) => void;
  onAddWidget: () => void;
  onClose: () => void;
};

export default function QuranCopySheet({
  visible,
  ayah,
  showArabic,
  showEnglish,
  showTransliteration,
  onCopy,
  onAddWidget,
  onClose,
}: QuranCopySheetProps) {
  const { theme } = useTheme();
  const themeColors = theme.colors;
  const styles = useMemo(() => createStyles(theme), [theme]);

  // `visible` and `ayah` clear together on close, so keep the last ayah around
  // for the duration of the close animation.
  const lastAyahRef = useRef(ayah);
  if (ayah) {
    lastAyahRef.current = ayah;
  }
  const activeAyah = ayah ?? lastAyahRef.current;

  const enabledCount = [showArabic, showEnglish, showTransliteration].filter(
    Boolean,
  ).length;
  const showCopyAll = enabledCount > 1;

  if (!activeAyah) {
    return null;
  }

  const title = `${activeAyah.surahNameEn} ${activeAyah.surahNumber}:${activeAyah.ayahNumber}`;

  return (
    <NativeSheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.content}>
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

          <View style={styles.divider} />
          <CopyRow
            icon="grid-outline"
            label="Add as widget"
            isLast
            isGold={false}
            styles={styles}
            themeColors={themeColors}
            onPress={onAddWidget}
          />
        </View>
      </View>
    </NativeSheet>
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
