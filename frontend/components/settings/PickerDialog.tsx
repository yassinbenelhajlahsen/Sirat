// frontend/components/settings/PickerDialog.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardEvent,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import GlassSurface from "@/components/ui/GlassSurface";
import { Body, Footnote, Title3 } from "@/components/ui/Text";
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

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e: KeyboardEvent) => setInset(e.endCoordinates?.height ?? 0);
    const onHide = () => setInset(0);
    const s = Keyboard.addListener(showEvt, onShow);
    const h = Keyboard.addListener(hideEvt, onHide);
    return () => {
      s.remove();
      h.remove();
    };
  }, []);
  return inset;
}

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
  const bottomInset = useKeyboardInset();

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

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.cardWrap, { marginBottom: bottomInset > 0 ? bottomInset * 0.4 : 0 }]}
          onPress={() => {}}
        >
          <GlassSurface tier="card" radius={theme.radii.cardLg} style={styles.card}>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Title3 color={colors.white}>{title}</Title3>
                {subtitle ? (
                  <Footnote color={withOpacity(colors.white, 0.6)} style={styles.subtitle}>
                    {subtitle}
                  </Footnote>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={onClose}
                hitSlop={10}
              >
                <Ionicons name="close" size={22} color={withOpacity(colors.white, 0.7)} />
              </Pressable>
            </View>

            {searchable ? (
              <View style={styles.search}>
                <Ionicons name="search" size={18} color={withOpacity(colors.white, 0.5)} />
                <TextInput
                  ref={inputRef}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={withOpacity(colors.white, 0.5)}
                  value={query}
                  onChangeText={setQuery}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  style={styles.searchInput}
                />
              </View>
            ) : null}

            <FlatList
              data={filtered}
              keyExtractor={(item) => String(item.value)}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              renderItem={({ item }) => {
                const isSelected = item.value === selected;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => {
                      haptics("selection");
                      onSelect(item.value);
                    }}
                    style={({ pressed }) => [
                      styles.itemRow,
                      pressed && styles.itemPressed,
                    ]}
                  >
                    <Body color={isSelected ? colors.accent : colors.white}>
                      {item.label}
                    </Body>
                    {isSelected ? (
                      <Ionicons name="checkmark" size={20} color={colors.accent} />
                    ) : null}
                  </Pressable>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </GlassSurface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: withOpacity(colors.black, 0.55),
      justifyContent: "center",
      paddingHorizontal: spacing.xl,
    },
    cardWrap: { width: "100%", alignItems: "center" },
    card: { width: "100%", maxWidth: 480, maxHeight: Math.round(SCREEN_HEIGHT * 0.7) },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
    },
    headerText: { flex: 1, paddingRight: spacing.md },
    subtitle: { marginTop: 4 },
    search: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: theme.radii.row,
      borderCurve: "continuous",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: withOpacity(colors.white, 0.12),
      backgroundColor: withOpacity(colors.white, 0.05),
    },
    searchInput: {
      flex: 1,
      color: colors.white,
      fontSize: 15,
      fontWeight: "400",
      paddingVertical: 4,
    },
    list: { flexGrow: 0 },
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
    },
    itemPressed: { backgroundColor: withOpacity(colors.white, 0.06) },
    separator: {
      height: StyleSheet.hairlineWidth,
      marginHorizontal: spacing.xl,
      backgroundColor: withOpacity(colors.white, 0.08),
    },
  });
};
