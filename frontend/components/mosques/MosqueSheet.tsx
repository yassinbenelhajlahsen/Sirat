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
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
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
  bottomInset: number;
};

// Apple-style adaptive background: a frosted blur of the map at peek/half so it
// stays light and unobtrusive, fading into a solid gradient + aurora (matching
// the rest of the app) as the sheet is dragged to full.
function SheetBackground({ style, animatedIndex }: BottomSheetBackgroundProps) {
  const { theme } = useTheme();
  const { colors } = theme;

  const solidStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedIndex.value,
      [1, 2],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <Animated.View pointerEvents="none" style={[style, styles.bg]}>
      <BlurView intensity={36} tint="dark" style={StyleSheet.absoluteFill} />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: withOpacity(colors.primaryDeep, 0.5) },
        ]}
      />
      <Animated.View style={[StyleSheet.absoluteFill, solidStyle]}>
        <LinearGradient
          colors={[colors.primaryDeep, colors.primary, colors.primaryLift]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Aurora />
      </Animated.View>
    </Animated.View>
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
      bottomInset={bottomInset}
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
          paddingBottom: spacing.xl,
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
