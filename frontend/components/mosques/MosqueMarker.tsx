import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Callout, Marker } from "react-native-maps";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { Mosque } from "@/services/getNearbyMosques";

type Props = {
  mosque: Mosque;
  selected?: boolean;
  onPress?: () => void;
  onDirections?: () => void;
};

function MosqueMarkerBase({ mosque, selected = false, onPress, onDirections }: Props) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Marker
      identifier={mosque.id}
      coordinate={{ latitude: mosque.lat, longitude: mosque.lng }}
      anchor={{ x: 0.5, y: 1 }}
      calloutAnchor={{ x: 0.5, y: 0 }}
      tracksViewChanges={selected}
      onPress={onPress}
    >
      <View
        style={[
          styles.pin,
          { backgroundColor: colors.accent, borderColor: withOpacity(colors.primaryMuted, 0.9) },
          selected && { transform: [{ scale: 1.25 }], borderColor: colors.white, shadowOpacity: 0.5 },
        ]}
      >
        <FontAwesome5 name="mosque" size={selected ? 20 : 18} color={colors.primaryMuted} solid />
      </View>

      {/* Tapping the bubble opens directions (works on iOS + Android). */}
      <Callout tooltip onPress={onDirections}>
        <View style={styles.callout}>
          <Text style={styles.calloutTitle} numberOfLines={2}>
            {mosque.name}
          </Text>
          {mosque.address ? (
            <Text style={styles.calloutAddress} numberOfLines={2}>
              {mosque.address}
            </Text>
          ) : null}
          <View style={styles.directionsButton}>
            <Ionicons name="navigate" size={13} color={colors.onAccent} />
            <Text style={styles.directionsText}>Directions</Text>
          </View>
        </View>
      </Callout>
    </Marker>
  );
}

export default memo(MosqueMarkerBase);

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    pin: {
      borderRadius: 30,
      padding: 5,
      borderWidth: 2,
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },
    callout: {
      width: 212,
      backgroundColor: colors.primary,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: withOpacity(colors.accent, 0.5),
      padding: spacing.md,
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: 0.4,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    calloutTitle: {
      color: colors.accent,
      fontWeight: "700",
      fontSize: 15,
      textAlign: "center",
      marginBottom: 2,
    },
    calloutAddress: {
      color: withOpacity(colors.white, 0.85),
      fontWeight: "400",
      fontSize: 12,
      textAlign: "center",
      marginBottom: spacing.sm,
    },
    directionsButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.accent,
      borderRadius: 9,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    directionsText: {
      color: colors.onAccent,
      fontWeight: "600",
      fontSize: 12,
    },
  });
};
