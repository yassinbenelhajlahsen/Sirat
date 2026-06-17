import BottomSheet, {
  BottomSheetFlatList,
  type BottomSheetBackgroundProps,
} from "@gorhom/bottom-sheet";
import { Headline } from "@/components/ui/Text";
import MosqueRow from "@/components/mosques/MosqueRow";
import { withOpacity } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { distanceKm, formatDistanceShort } from "@/utils/geo";
import type { Mosque } from "@/services/getNearbyMosques";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

type MosqueSheetProps = {
  mosques: Mosque[];
  userLoc: { latitude: number; longitude: number } | null;
  selectedId: string | null;
  onSelect: (m: Mosque) => void;
  onDirections: (m: Mosque) => void;
  bottomInset: number;
};

// Translucent dark at peek/half so the map reads through and it stays light,
// settling to a solid surface at full. Flat colour (no blur, no aurora) so it
// is cheap and never shows a clipped edge.
function SheetBackground({ style, animatedIndex }: BottomSheetBackgroundProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const fillStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedIndex.value,
      [1, 2],
      [0.82, 1],
      Extrapolation.CLAMP,
    ),
  }));
  return (
    <View pointerEvents="none" style={[style, styles.bg]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          fillStyle,
          { backgroundColor: colors.primaryDeep },
        ]}
      />
    </View>
  );
}

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

  // Shared with the chrome strip behind the floating tab bar so the bottom
  // matches the sheet in every state.
  const animatedIndex = useSharedValue(1);
  const chromeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedIndex.value,
      [1, 2],
      [0.82, 1],
      Extrapolation.CLAMP,
    ),
  }));

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
      <Animated.View
        pointerEvents="none"
        style={[
          styles.chrome,
          { height: bottomInset, backgroundColor: colors.primaryDeep },
          chromeStyle,
        ]}
      />
      <BottomSheet
        index={1}
        snapPoints={snapPoints}
        bottomInset={bottomInset}
        animatedIndex={animatedIndex}
        enablePanDownToClose={false}
        backgroundComponent={SheetBackground}
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
  bg: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: withOpacity("#ffffff", 0.12),
    overflow: "hidden",
  },
  chrome: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
});
