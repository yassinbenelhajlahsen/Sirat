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
import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import React, { useMemo } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

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
  const glass = Platform.OS === "ios" && isGlassEffectAPIAvailable();

  const snapPoints = useMemo(() => ["18%", "50%", "92%"], []);

  // Shared with the chrome strip behind the floating tab bar so the bottom
  // matches the sheet in every state.
  const animatedIndex = useSharedValue(1);
  const chromeSolid = useAnimatedStyle(() => ({
    opacity: interpolate(animatedIndex.value, [1, 2], [0, 1], Extrapolation.CLAMP),
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
      {/* Chrome behind the floating tab bar — same glass + solid-fade as the
          sheet so the bottom reads as one continuous surface. */}
      <View
        pointerEvents="none"
        style={[styles.chrome, { height: bottomInset }]}
      >
        {glass ? (
          <GlassView glassEffectStyle="regular" style={StyleSheet.absoluteFill} />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: withOpacity(colors.primaryDeep, 0.82) },
            ]}
          />
        )}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            chromeSolid,
            { backgroundColor: colors.primary },
          ]}
        />
      </View>

      <BottomSheet
        index={1}
        snapPoints={snapPoints}
        bottomInset={bottomInset}
        animatedIndex={animatedIndex}
        animatedPosition={animatedPosition}
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
  chrome: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
  },
});
