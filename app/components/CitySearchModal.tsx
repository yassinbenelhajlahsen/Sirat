// components/CitySearchModal.tsx
import { colors as themeColors, withOpacity } from "@/app/constants/theme";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardEvent,
  Modal,
  Platform,
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
    bg: withOpacity(themeColors.black, 0.65),
    card: themeColors.primary,
    cardAlt: themeColors.primarySurfaceAlt,
    text: themeColors.white,
    accent: themeColors.accent,
    divider: themeColors.primaryOutline,
    placeholder: themeColors.grayLight,
  },
}: CitySearchModalProps) {
  const bottomInset = useKeyboardInset();

  const [query, setQuery] = useState(initialQuery);
  const debounced = useDebounced(query, 150);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      // focus a tick later so the modal is already mounted
      const id = setTimeout(() => inputRef.current?.focus(), 60);
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

  // Fixed sheet height so it never collapses under the keyboard
  const SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * 0.72);

  return (
    <Modal
      visible={visible}
      animationType={Platform.OS === "ios" ? "slide" : "fade"}
      onRequestClose={onClose}
      transparent
    >
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingTop: 14,
            paddingHorizontal: 16,
            height: SHEET_HEIGHT,
            // Keep content unobstructed by keyboard
            paddingBottom: 16 + bottomInset,
          }}
        >
          {/* Grab handle */}
          <View
            style={{
              alignSelf: "center",
              width: 48,
              height: 5,
              borderRadius: 999,
              backgroundColor: colors.divider,
              marginBottom: 12,
            }}
          />

          {/* Search input */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.cardAlt,
              borderRadius: 12,
              paddingHorizontal: 12,
              height: 48,
            }}
          >
            <TextInput
              ref={inputRef}
              placeholder="Search city"
              placeholderTextColor={colors.placeholder}
              style={{ flex: 1, color: colors.text, fontSize: 16 }}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")}>
                <Text style={{ color: colors.accent, fontSize: 14 }}>
                  Clear
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Results */}
          <FlatList
            style={{ marginTop: 12 }}
            data={filtered}
            keyExtractor={(item) => item.value}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={30}
            windowSize={6}
            ItemSeparatorComponent={() => (
              <View
                style={{
                  height: 1,
                  backgroundColor: colors.divider,
                  marginLeft: 8,
                }}
              />
            )}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => onSelectKey(item.value)}
                style={{ paddingVertical: 12, paddingHorizontal: 6 }}
              >
                <Text style={{ color: colors.text, fontSize: 16 }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={{ paddingVertical: 20, alignItems: "center" }}>
                <Text style={{ color: colors.text, fontSize: 16 }}>
                  No results
                </Text>
              </View>
            }
            // Extra bottom padding so last cells scroll above the keyboard nicely
            contentContainerStyle={{ paddingBottom: 20 }}
          />

          {/* Footer */}
          <View style={{ alignItems: "flex-end", marginTop: 8 }}>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: colors.accent, fontSize: 16 }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
