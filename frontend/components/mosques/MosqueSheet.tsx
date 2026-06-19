import BottomSheet, {
  BottomSheetFlatList,
} from "@gorhom/bottom-sheet";
import { Headline } from "@/components/ui/Text";
import MosqueRow from "@/components/mosques/MosqueRow";
import SheetBackground from "@/components/ui/SheetBackground";
import { withOpacity } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { distanceKm, formatDistanceShort } from "@/utils/geo";
import type { Mosque } from "@/services/getNearbyMosques";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { type SharedValue } from "react-native-reanimated";

// Opaque background (no GlassView/BlurView) — the sheet sits over a live MapView,
// and a real-time backdrop filter forces a GPU readback of the redrawing map
// every frame. A flat opaque gradient removes that per-frame cost entirely.
function MosqueSheetBackground(p: Parameters<typeof SheetBackground>[0]) {
  return <SheetBackground {...p} opaque />;
}

type MosqueSheetProps = {
  mosques: Mosque[];
  userLoc: { latitude: number; longitude: number } | null;
  selectedId: string | null;
  onSelect: (m: Mosque) => void;
  onDirections: (m: Mosque) => void;
  bottomInset: number;
  animatedPosition?: SharedValue<number>;
};

export default function MosqueSheet({
  mosques,
  userLoc,
  selectedId,
  onSelect,
  onDirections,
  bottomInset,
  animatedPosition,
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
    <>
      {/* Chrome behind the floating tab bar — a flat fill matching the sheet's
          opaque bottom edge so the two read as one continuous surface. */}
      <View
        pointerEvents="none"
        style={[
          styles.chrome,
          { height: bottomInset, backgroundColor: colors.primary },
        ]}
      />

      <BottomSheet
        index={0}
        snapPoints={snapPoints}
        bottomInset={bottomInset}
        animatedPosition={animatedPosition}
        enablePanDownToClose={false}
        backgroundComponent={MosqueSheetBackground}
        handleIndicatorStyle={handleStyle}
      >
        <BottomSheetFlatList
          data={rows}
          keyExtractor={(m) => m.id}
          ListHeaderComponent={Header}
          renderItem={({ item }) => {
            const km = userLoc
              ? distanceKm(
                  userLoc.latitude,
                  userLoc.longitude,
                  item.lat,
                  item.lng,
                )
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
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingBottom: spacing.xl,
            gap: spacing.md,
          }}
        />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  chrome: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
  },
});
