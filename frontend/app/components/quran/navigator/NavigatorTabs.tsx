import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors as themeColors, withOpacity } from "@/constants/theme";

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

const styles = StyleSheet.create({
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
    backgroundColor: withOpacity(themeColors.white, 0.08),
    borderWidth: 1,
    borderColor: withOpacity(themeColors.white, 0.16),
    alignItems: "center",
    justifyContent: "center",
  },
  tabButtonSpacing: {
    marginRight: 10,
  },
  tabButtonActive: {
    backgroundColor: themeColors.accent,
    borderColor: themeColors.accent,
    shadowColor: themeColors.accent,
    shadowOpacity: 0.32,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  tabLabel: {
    color: withOpacity(themeColors.white, 0.8),
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: themeColors.primaryDeep,
  },
});
