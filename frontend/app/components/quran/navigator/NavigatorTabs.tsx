import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors as themeColors, withOpacity } from "@/constants/theme";

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
  { key: "bookmarks", label: "Bookmarks" },
  { key: "surah", label: "Surah" },
  { key: "juz", label: "Juz" },
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
    paddingBottom: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: withOpacity(themeColors.white, 0.12),
    borderWidth: 1,
    borderColor: withOpacity(themeColors.white, 0.12),
    alignItems: "center",
    justifyContent: "center",
  },
  tabButtonSpacing: {
    marginRight: 10,
  },
  tabButtonActive: {
    backgroundColor: themeColors.accent,
    borderColor: themeColors.accent,
  },
  tabLabel: {
    color: withOpacity(themeColors.white, 0.78),
    fontSize: 14,
    fontWeight: "600",
  },
  tabLabelActive: {
    color: themeColors.primaryDeep,
  },
});
