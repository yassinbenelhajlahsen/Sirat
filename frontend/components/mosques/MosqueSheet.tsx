import BottomSheet, {
  BottomSheetFlatList,
  type BottomSheetBackgroundProps,
} from "@gorhom/bottom-sheet";
import { Headline } from "@/components/ui/Text";
import Aurora from "@/components/ui/Aurora";
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
} from "react-native-reanimated";

type MosqueSheetProps = {
  mosques: Mosque[];
  userLoc: { latitude: number; longitude: number } | null;
  selectedId: string | null;
  onSelect: (m: Mosque) => void;
  onDirections: (m: Mosque) => void;
  tabBarClearance: number;
};

// Translucent dark at peek/half so the map reads through and it stays light and
// unobtrusive, settling into a solid surface with a faint aurora as it is
// dragged to full. No blur — blurring the live map underneath is too expensive.
function SheetBackground({ style, animatedIndex }: BottomSheetBackgroundProps) {
  const { theme } = useTheme();
  const { colors } = theme;

  const baseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedIndex.value,
      [1, 2],
      [0.82, 1],
      Extrapolation.CLAMP,
    ),
  }));
  const auroraStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedIndex.value,
      [1, 2],
      [0, 0.55],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <View pointerEvents="none" style={[style, styles.bg]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          baseStyle,
          { backgroundColor: colors.primaryDeep },
        ]}
      />
      <Animated.View style={[StyleSheet.absoluteFill, auroraStyle]}>
        <Aurora />
      </Animated.View>
    </View>
  );
}

export default function MosqueSheet({
  mosques,
  userLoc,
  selectedId,
  onSelect,
  onDirections,
  tabBarClearance,
}: MosqueSheetProps) {
  const { theme } = useTheme();
  const { colors, spacing } = theme;

  // The sheet fills to the bottom of the screen (so the floating tab bar sits
  // on it, with no mismatched strip behind it). Peek is an absolute height that
  // clears the tab bar and still shows the header + a couple of rows.
  const snapPoints = useMemo(
    () => [tabBarClearance + 210, "55%", "92%"],
    [tabBarClearance],
  );

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
    <BottomSheet
      index={1}
      snapPoints={snapPoints}
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
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingBottom: tabBarClearance + spacing.md,
          gap: spacing.md,
        }}
      />
    </BottomSheet>
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
});
