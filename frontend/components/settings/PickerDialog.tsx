// frontend/components/settings/PickerDialog.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";

import PressableScale from "@/components/PressableScale";
import AppIcon from "@/components/ui/AppIcon";
import NativeSheet from "@/components/ui/NativeSheet";
import { Body, Footnote } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";

export type PickerItem<T extends string | number> = { label: string; value: T };

type Props<T extends string | number> = {
  visible: boolean;
  title: string;
  subtitle?: string;
  items: PickerItem<T>[];
  selected?: T;
  searchable?: boolean;
  searchPlaceholder?: string;
  onSelect: (value: T) => void;
  onClose: () => void;
};

// A searchable picker has to reserve room for the keyboard, so it snaps; a short
// list sizes itself to its content.
const SEARCH_DETENTS = [0.6, 0.92];

function useDebounced<T>(value: T, delay = 150) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

export default function PickerDialog<T extends string | number>({
  visible,
  title,
  subtitle,
  items,
  selected,
  searchable = false,
  searchPlaceholder = "Search",
  onSelect,
  onClose,
}: Props<T>) {
  const { theme } = useTheme();
  const { colors } = theme;
  const haptics = useHaptics();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { height: windowHeight } = useWindowDimensions();

  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 150);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) setQuery("");
  }, [visible]);

  useEffect(() => {
    if (visible && searchable) {
      const id = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(id);
    }
  }, [visible, searchable]);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q));
  }, [items, debounced]);

  return (
    <NativeSheet
      visible={visible}
      onClose={onClose}
      title={title}
      detents={searchable ? SEARCH_DETENTS : undefined}
    >
      {subtitle ? (
        <Footnote color={colors.textSecondary} style={styles.subtitle}>
          {subtitle}
        </Footnote>
      ) : null}
      {searchable ? (
        <View style={styles.search}>
          <AppIcon name="search" size={18} color={colors.iconMuted} />
          <TextInput
            ref={inputRef}
            placeholder={searchPlaceholder}
            placeholderTextColor={colors.textTertiary}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel="Search"
            maxFontSizeMultiplier={1.4}
            style={styles.searchInput}
          />
        </View>
      ) : null}
      <FlatList
        data={filtered}
        keyExtractor={(item: PickerItem<T>) => String(item.value)}
        keyboardShouldPersistTaps="handled"
        // A fit-to-content sheet has no bounded height, so cap the list or a long one never scrolls.
        style={searchable ? styles.listFill : { maxHeight: windowHeight * 0.7 }}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }: { item: PickerItem<T>; index: number }) => {
          const isSelected = item.value === selected;
          return (
            <PressableScale
              variant="row"
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => {
                haptics("selection");
                onSelect(item.value);
              }}
              style={styles.itemRow}
            >
              {index > 0 ? <View pointerEvents="none" style={styles.separator} /> : null}
              <Body color={isSelected ? colors.accent : colors.white} style={styles.itemLabel}>
                {item.label}
              </Body>
              {isSelected ? <AppIcon name="checkmark" size={20} color={colors.accent} /> : null}
            </PressableScale>
          );
        }}
      />
    </NativeSheet>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  const isLight = theme.name === "light";
  return StyleSheet.create({
    list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
    listFill: { flex: 1 },
    subtitle: { paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
    search: {
      marginHorizontal: spacing.xl,
      marginBottom: spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: theme.radii.row,
      borderCurve: "continuous",
      backgroundColor: isLight
        ? withOpacity(colors.black, 0.05)
        : withOpacity(colors.white, 0.07),
    },
    searchInput: {
      flex: 1,
      color: colors.white,
      fontSize: 15,
      fontWeight: "400",
      paddingVertical: spacing.xs,
    },
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 48,
      paddingVertical: spacing.md,
    },
    itemLabel: { flex: 1, minWidth: 0, paddingRight: spacing.md },
    separator: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: withOpacity(colors.white, 0.1),
    },
  });
};
