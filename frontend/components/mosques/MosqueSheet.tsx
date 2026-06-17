import BottomSheet, { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { Caption, Headline } from "@/components/ui/Text";
import MosqueRow from "@/components/mosques/MosqueRow";
import { withOpacity } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { bearingDeg, cardinal, distanceKm, formatDistanceShort } from "@/utils/geo";
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

  const minDistanceKm = useMemo(() => {
    if (!userLoc || rows.length === 0) return null;
    return distanceKm(userLoc.latitude, userLoc.longitude, rows[0].lat, rows[0].lng);
  }, [rows, userLoc]);

  const bgStyle = {
    backgroundColor: theme.materials.chrome.fill,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: theme.materials.chrome.border,
  };

  const handleStyle = {
    backgroundColor: withOpacity(colors.white, 0.3),
    width: 38,
  };

  function Header() {
    const title = rows.length === 0 ? "No mosques nearby" : `${rows.length} mosques nearby`;
    return (
      <View style={{ paddingVertical: spacing.lg, gap: spacing.xs }}>
        <Headline color={colors.white}>{title}</Headline>
        {userLoc && minDistanceKm !== null && rows.length > 0 && (
          <Caption color={withOpacity(colors.white, 0.5)}>
            {`Nearest ${formatDistanceShort(minDistanceKm)}`}
          </Caption>
        )}
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
          const direction =
            userLoc !== null
              ? cardinal(bearingDeg(userLoc.latitude, userLoc.longitude, item.lat, item.lng))
              : null;
          return (
            <MosqueRow
              name={item.name}
              address={item.address}
              distanceLabel={distanceLabel}
              direction={direction}
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
