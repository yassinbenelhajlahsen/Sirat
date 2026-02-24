import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

import PressableScale from "../../PressableScale";

export type NavigatorTabKey = "goto" | "bookmarks";

type NavigatorTabsProps = {
  selectedTab: NavigatorTabKey;
  onSelectTab: (tab: NavigatorTabKey) => void;
};

const TAB_ITEMS: readonly {
  key: NavigatorTabKey;
  label: string;
}[] = [
  { key: "goto", label: "Go To" },
  { key: "bookmarks", label: "Bookmarks" },
];

function NavigatorTabs({ selectedTab, onSelectTab }: NavigatorTabsProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      {TAB_ITEMS.map((item, index) => {
        const isActive = selectedTab === item.key;
        const isLast = index === TAB_ITEMS.length - 1;
        return (
          <PressableScale
            key={item.key}
            style={[
              styles.tabButton,
              !isLast && styles.tabButtonSpacing,
              isActive && styles.tabButtonActive,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            onPress={() => onSelectTab(item.key)}
            scaleTo={0.94}
          >
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {item.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

export default memo(NavigatorTabs);

const createStyles = (theme: AppTheme) => {
  const themeColors = theme.colors;
  const isLight = theme.name === "light";

  return StyleSheet.create({
    container: {
      flexDirection: "row",
      paddingHorizontal: 20,
      paddingBottom: 10,
      paddingTop: 2,
    },
    tabButton: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: 999,
      backgroundColor: isLight
        ? withOpacity(themeColors.primarySurface, 0.9)
        : withOpacity(themeColors.white, 0.08),
      borderWidth: 1,
      borderColor: isLight
        ? withOpacity(themeColors.primaryBorder, 0.66)
        : withOpacity(themeColors.white, 0.16),
      alignItems: "center",
      justifyContent: "center",
    },
    tabButtonSpacing: {
      marginRight: 10,
    },
    tabButtonActive: {
      backgroundColor: isLight ? themeColors.accentSoft : themeColors.accent,
      borderColor: isLight ? themeColors.primaryOutline : themeColors.accent,
      shadowColor: isLight ? themeColors.primaryOutline : themeColors.accent,
      shadowOpacity: 0.32,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },
    tabLabel: {
      color: isLight
        ? withOpacity(themeColors.grayDark, 0.95)
        : withOpacity(themeColors.white, 0.8),
      fontSize: 13,
      fontWeight: "600",
      letterSpacing: 0.3,
    },
    tabLabelActive: {
      color: isLight ? themeColors.offWhite : themeColors.onAccent,
    },
  });
};
