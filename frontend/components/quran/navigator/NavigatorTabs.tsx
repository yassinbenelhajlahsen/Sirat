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
              style={[styles.segment, isActive && styles.segmentActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              onPress={() => onSelectTab(item.key)}
              scaleTo={0.94}
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
      paddingHorizontal: 20,
      paddingBottom: 10,
      paddingTop: 2,
    },
    pill: {
      flexDirection: "row",
      backgroundColor: withOpacity(themeColors.black, 0.22),
      borderRadius: theme.radii.pill,
      padding: 3,
    },
    segment: {
      flex: 1,
      minHeight: 40,
      paddingVertical: 9,
      borderRadius: theme.radii.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    segmentActive: {
      backgroundColor: isLight ? themeColors.accentSoft : themeColors.accent,
      shadowColor: isLight ? themeColors.primaryOutline : themeColors.accent,
      shadowOpacity: 0.32,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },
    segmentLabel: {
      fontWeight: "600",
      letterSpacing: 0.3,
    },
  });
};
