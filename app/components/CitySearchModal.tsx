// components/CitySearchModal.tsx
import { colors as themeColors, withOpacity } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardEvent,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// -------------------- Internal keyboard inset hook --------------------
function useKeyboardInset() {
  const [bottomInset, setBottomInset] = useState(0);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (e: KeyboardEvent) => {
      const h = e.endCoordinates?.height ?? 0;
      setBottomInset(h);
    };
    const onHide = () => setBottomInset(0);

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return bottomInset;
}

// -------------------- Types --------------------
type Item = { label: string; value: string };

export interface CitySearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectKey: (cityKey: string) => void;
  items: Item[]; // precomputed list, e.g., from CITIES.map(...)
  initialQuery?: string;
  colors?: {
    bg: string;
    card: string;
    cardAlt: string;
    text: string;
    accent: string;
    divider: string;
    placeholder: string;
  };
}

// -------------------- Debounce --------------------
function useDebounced<T>(value: T, delay = 150) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

// -------------------- Component --------------------
const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function CitySearchModal({
  visible,
  onClose,
  onSelectKey,
  items,
  initialQuery = "",
  colors = {
    bg: withOpacity(themeColors.black, 0.55),
    card: withOpacity(themeColors.primaryDeep, 0.96),
    cardAlt: withOpacity(themeColors.primarySurfaceAlt, 0.9),
    text: themeColors.white,
    accent: themeColors.accent,
    divider: withOpacity(themeColors.white, 0.12),
    placeholder:
      // fall back if grayLight does not exist
      (themeColors as any).grayLight ?? withOpacity(themeColors.white, 0.55),
  },
}: CitySearchModalProps) {
  const bottomInset = useKeyboardInset();

  const [query, setQuery] = useState(initialQuery);
  const debounced = useDebounced(query, 150);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      const id = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(id);
    } else {
      setQuery("");
    }
  }, [visible]);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q));
  }, [items, debounced]);

  const MAX_CARD_HEIGHT = Math.round(SCREEN_HEIGHT * 0.7);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      transparent
    >
      <View
        style={[
          styles.overlay,
          {
            backgroundColor: colors.bg,
          },
        ]}
      >
        <View
          style={[
            styles.cardWrapper,
            {
              marginBottom: bottomInset > 0 ? bottomInset * 0.4 : 0,
            },
          ]}
        >
          <View
            style={[
              styles.card,
              {
                maxHeight: MAX_CARD_HEIGHT,
                backgroundColor: colors.card,
                borderColor: withOpacity(colors.accent, 0.6),
              },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Select city</Text>
                <Text
                  style={[
                    styles.subtitle,
                    { color: withOpacity(colors.text, 0.7) },
                  ]}
                >
                  Search from the supported cities list
                </Text>
              </View>

              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={onClose}
                style={styles.dismissButton}
                activeOpacity={0.8}
              >
                <View style={styles.dismissIcon}>
                  <View style={[styles.dismissLine, styles.dismissLineFirst]} />
                  <View
                    style={[styles.dismissLine, styles.dismissLineSecond]}
                  />
                </View>
              </TouchableOpacity>
            </View>

            {/* Search input */}
            <View
              style={[
                styles.searchContainer,
                {
                  backgroundColor: themeColors.primaryDark,
                  borderColor: withOpacity(colors.accent, 0.45),
                },
              ]}
            >
              <Ionicons
                name="search"
                size={18}
                color={withOpacity(colors.placeholder, 0.85)}
                style={styles.searchIcon}
              />
              <TextInput
                ref={inputRef}
                placeholder="Search city"
                placeholderTextColor={colors.placeholder}
                style={[styles.searchInput, { color: colors.text }]}
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity
                  onPress={() => setQuery("")}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={withOpacity(colors.accent, 0.9)}
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* Results */}
            <FlatList
              style={styles.list}
              data={filtered}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              initialNumToRender={30}
              windowSize={8}
              ItemSeparatorComponent={() => (
                <View
                  style={[
                    styles.itemSeparator,
                    { backgroundColor: colors.divider },
                  ]}
                />
              )}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => onSelectKey(item.value)}
                  activeOpacity={0.85}
                  style={styles.listRow}
                >
                  <Text
                    style={[
                      styles.listLabel,
                      {
                        color: colors.text,
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text
                    style={[
                      styles.emptyPrimary,
                      { color: withOpacity(colors.text, 0.9) },
                    ]}
                  >
                    No results found
                  </Text>
                  <Text
                    style={[
                      styles.emptySecondary,
                      { color: withOpacity(colors.text, 0.7) },
                    ]}
                  >
                    Try a different spelling or nearby city name.
                  </Text>
                </View>
              }
              contentContainerStyle={styles.listContent}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  cardWrapper: {
    width: "100%",
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: withOpacity(themeColors.black, 0.9),
    shadowOpacity: 0.35,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 18 },
    elevation: 10,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: withOpacity(themeColors.white, 0.08),
  },
  title: {
    fontSize: 18,
    fontFamily: "SFProDisplay-Semibold",
    letterSpacing: 0.2,
    color: themeColors.white,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: "SFProDisplay-Regular",
  },
  dismissButton: {
    padding: 6,
  },
  dismissIcon: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dismissLine: {
    position: "absolute",
    width: 18,
    height: 2,
    backgroundColor: themeColors.white,
    borderRadius: 999,
  },
  dismissLineFirst: {
    transform: [{ rotate: "45deg" }],
  },
  dismissLineSecond: {
    transform: [{ rotate: "-45deg" }],
  },
  searchContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 10,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "SFProDisplay-Regular",
    paddingVertical: 6,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: 16,
  },
  listRow: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  listLabel: {
    fontSize: 16,
    fontFamily: "SFProDisplay-Regular",
  },
  itemSeparator: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
  },
  emptyState: {
    paddingHorizontal: 20,
    paddingVertical: 26,
    alignItems: "center",
  },
  emptyPrimary: {
    fontSize: 15,
    fontFamily: "SFProDisplay-Semibold",
  },
  emptySecondary: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: "SFProDisplay-Regular",
    textAlign: "center",
    lineHeight: 18,
  },
});
