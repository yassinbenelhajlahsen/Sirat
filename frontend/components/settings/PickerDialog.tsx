// frontend/components/settings/PickerDialog.tsx
import BottomSheet, {
  BottomSheetFlatList,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import PressableScale from "@/components/PressableScale";
import AppIcon from "@/components/ui/AppIcon";
import SheetBackground from "@/components/ui/SheetBackground";
import SheetHeader from "@/components/ui/SheetHeader";
import { Body } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import { useTabBarClearance } from "@/hooks/useTabBarClearance";

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

function PickerSheetBackground(p: Parameters<typeof SheetBackground>[0]) {
  return <SheetBackground {...p} solid />;
}

// A searchable picker has to reserve room for the keyboard, so it snaps; a short
// list sizes itself to its content.
const SEARCH_SNAP_POINTS = ["60%", "92%"];

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
  const tabBarClearance = useTabBarClearance();

  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 150);
  const inputRef = useRef<{ focus: () => void }>(null);

  const [mounted, setMounted] = useState(visible);
  const sheetRef = useRef<BottomSheet>(null);
  const previousVisibleRef = useRef(visible);

  useEffect(() => {
    if (!visible) setQuery("");
    else setMounted(true);
  }, [visible]);

  useEffect(() => {
    if (visible && !previousVisibleRef.current) {
      sheetRef.current?.snapToIndex(0);
    } else if (!visible && previousVisibleRef.current) {
      sheetRef.current?.close();
    }
    previousVisibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    if (visible && searchable) {
      const id = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(id);
    }
  }, [visible, searchable]);

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
    () => ({ backgroundColor: withOpacity(colors.white, 0.3), width: 38 }),
    [colors.white],
  );

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q));
  }, [items, debounced]);

  if (!mounted) return null;

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={searchable ? SEARCH_SNAP_POINTS : undefined}
      enableDynamicSizing={!searchable}
      enablePanDownToClose
      backgroundComponent={PickerSheetBackground}
      handleIndicatorStyle={handleIndicatorStyle}
      onChange={handleSheetChange}
    >
      <BottomSheetFlatList
        data={filtered}
        keyExtractor={(item: PickerItem<T>) => String(item.value)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.list,
          { paddingBottom: tabBarClearance + theme.spacing.lg },
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            <SheetHeader title={title} subtitle={subtitle} onClose={onClose} />
            {searchable ? (
              <View style={styles.search}>
                <AppIcon name="search" size={18} color={colors.iconMuted} />
                <BottomSheetTextInput
                  ref={inputRef as never}
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
          </View>
        }
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
    </BottomSheet>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  const isLight = theme.name === "light";
  return StyleSheet.create({
    list: { paddingHorizontal: spacing.xl },
    header: { marginBottom: spacing.sm },
    search: {
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
