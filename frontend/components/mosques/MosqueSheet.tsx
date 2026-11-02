import { Footnote } from "@/components/ui/Text";
import MosqueRow from "@/components/mosques/MosqueRow";
import NativeSheet from "@/components/ui/NativeSheet";
import { useTheme } from "@/context/ThemeContext";
import { distanceKm, formatDistanceShort } from "@/utils/geo";
import type { Mosque } from "@/services/getNearbyMosques";
import { useCallback, useMemo } from "react";
import { FlatList, StyleSheet, View } from "react-native";

const DETENTS = [0.5, 0.92];

type MosqueSheetProps = {
  mosques: Mosque[];
  userLoc: { latitude: number; longitude: number } | null;
  selectedId: string | null;
  onSelect: (m: Mosque) => void;
  onDirections: (m: Mosque) => void;
  visible: boolean;
  onClose: () => void;
};

export default function MosqueSheet({
  mosques,
  userLoc,
  selectedId,
  onSelect,
  onDirections,
  visible,
  onClose,
}: MosqueSheetProps) {
  const { theme } = useTheme();
  const { colors, spacing } = theme;

  const rows = useMemo(() => {
    const r = mosques.slice(0, 10);
    if (userLoc) {
      r.sort(
        (a, b) =>
          distanceKm(userLoc.latitude, userLoc.longitude, a.lat, a.lng) -
          distanceKm(userLoc.latitude, userLoc.longitude, b.lat, b.lng),
      );
    }
    return r;
  }, [mosques, userLoc]);

  const contentContainerStyle = useMemo(
    () => ({ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl }),
    [spacing.xl, spacing.xxl],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Mosque; index: number }) => {
      const km = userLoc
        ? distanceKm(userLoc.latitude, userLoc.longitude, item.lat, item.lng)
        : null;
      return (
        <MosqueRow
          name={item.name}
          address={item.address}
          distanceLabel={km !== null ? formatDistanceShort(km) : null}
          selected={item.id === selectedId}
          separated={index > 0}
          onPress={() => onSelect(item)}
          onDirections={() => onDirections(item)}
        />
      );
    },
    [userLoc, selectedId, onSelect, onDirections],
  );

  return (
    <NativeSheet
      visible={visible}
      onClose={onClose}
      title={rows.length === 0 ? "No mosques nearby" : "Nearby mosques"}
      detents={DETENTS}
      backgroundInteraction
    >
      <View style={styles.fill}>
        {rows.length > 0 ? (
          <Footnote color={colors.textTertiary} style={{ paddingHorizontal: spacing.xl }}>
            {`${rows.length} ${rows.length === 1 ? "result" : "results"}`}
          </Footnote>
        ) : null}
        <FlatList
          data={rows}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          style={styles.fill}
          contentContainerStyle={contentContainerStyle}
        />
      </View>
    </NativeSheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
