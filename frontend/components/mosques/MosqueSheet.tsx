import BottomSheet, { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { Headline } from "@/components/ui/Text";
import MosqueRow from "@/components/mosques/MosqueRow";
import { withOpacity } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { distanceKm, formatDistanceShort } from "@/utils/geo";
import type { Mosque } from "@/services/getNearbyMosques";
import React, { useMemo } from "react";
import { View } from "react-native";

type MosqueSheetProps = {
  mosques: Mosque[];
  userLoc: { latitude: number; longitude: number } | null;
  selectedId: string | null;
  onSelect: (m: Mosque) => void;
  onDirections: (m: Mosque) => void;
  bottomInset: number;
};

export default function MosqueSheet({
  mosques,
  userLoc,
  selectedId,
  onSelect,
  onDirections,
  bottomInset,
}: MosqueSheetProps) {
  const { theme } = useTheme();
  const { colors, spacing } = theme;

  const snapPoints = useMemo(() => ["18%", "50%", "92%"], []);

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

  const bgStyle = {
    backgroundColor: withOpacity(colors.primaryDeep, 0.97),
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: withOpacity(colors.white, 0.12),
  };

  const handleStyle = {
    backgroundColor: withOpacity(colors.white, 0.3),
    width: 38,
  };

  function Header() {
    const title = rows.length === 0 ? "No mosques nearby" : "Nearby mosques";
    return (
      <View style={{ paddingVertical: spacing.lg, gap: spacing.xs }}>
        <Headline color={colors.white}>{title}</Headline>
      </View>
    );
  }

  return (
    <BottomSheet
      index={1}
      snapPoints={snapPoints}
      bottomInset={bottomInset}
      enablePanDownToClose={false}
      backgroundStyle={bgStyle}
      handleIndicatorStyle={handleStyle}
    >
      <BottomSheetFlatList
        data={rows}
        keyExtractor={(m) => m.id}
        ListHeaderComponent={Header}
        renderItem={({ item }) => {
          const km = userLoc
            ? distanceKm(userLoc.latitude, userLoc.longitude, item.lat, item.lng)
            : null;
          const distanceLabel = km !== null ? formatDistanceShort(km) : null;
          return (
            <MosqueRow
              name={item.name}
              address={item.address}
              distanceLabel={distanceLabel}
              selected={item.id === selectedId}
              onPress={() => onSelect(item)}
              onDirections={() => onDirections(item)}
            />
          );
        }}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl }}
      />
    </BottomSheet>
  );
}
