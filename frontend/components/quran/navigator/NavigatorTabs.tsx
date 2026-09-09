import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { Footnote } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

import PressableScale from "../../PressableScale";

export type NavigatorTabKey = "surah" | "juz" | "bookmarks";

type NavigatorTabsProps = {
  selectedTab: NavigatorTabKey;
  onSelectTab: (tab: NavigatorTabKey) => void;
};

const TAB_ITEMS: readonly {
  key: NavigatorTabKey;
  label: string;
}[] = [
  { key: "surah", label: "Sūrah" },
  { key: "juz", label: "Juzʾ" },
  { key: "bookmarks", label: "Bookmarks" },
];

function NavigatorTabs({ selectedTab, onSelectTab }: NavigatorTabsProps) {
  const { theme } = useTheme();
  const themeColors = theme.colors;
  const isLight = theme.name === "light";
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <View style={styles.pill}>
        {TAB_ITEMS.map((item) => {
          const isActive = selectedTab === item.key;
          return (
            <PressableScale
              key={item.key}
              variant="button"
              style={[styles.segment, isActive && styles.segmentActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              onPress={() => onSelectTab(item.key)}
            >
              <Footnote
                color={
                  isActive
                    ? isLight
                      ? themeColors.offWhite
                      : themeColors.onAccent
                    : themeColors.textSecondary
                }
                style={styles.segmentLabel}
              >
                {item.label}
              </Footnote>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

export default memo(NavigatorTabs);

const createStyles = (theme: AppTheme) => {
  const themeColors = theme.colors;
  const isLight = theme.name === "light";

  return StyleSheet.create({
    container: {
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: theme.spacing.md,
      paddingTop: 2,
    },
    pill: {
      flexDirection: "row",
      backgroundColor: withOpacity(themeColors.white, 0.08),
      borderRadius: theme.radii.pill,
      padding: 2,
    },
    segment: {
      flex: 1,
      minHeight: 40,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radii.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    segmentActive: {
      backgroundColor: isLight ? themeColors.accentSoft : themeColors.accent,
    },
    segmentLabel: {
      fontWeight: "600",
      letterSpacing: 0.3,
    },
  });
};
