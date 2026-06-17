import { FontAwesome5 } from "@expo/vector-icons";
import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Marker } from "react-native-maps";
import { withOpacity } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { Mosque } from "@/services/getNearbyMosques";

type Props = { mosque: Mosque; selected?: boolean; onPress?: () => void };

function MosqueMarkerBase({ mosque, selected = false, onPress }: Props) {
  const { theme } = useTheme();
  const { colors } = theme;
  return (
    <Marker
      identifier={mosque.id}
      coordinate={{ latitude: mosque.lat, longitude: mosque.lng }}
      anchor={{ x: 0.5, y: 1 }}
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
    </Marker>
  );
}

export default memo(MosqueMarkerBase);

const styles = StyleSheet.create({
  pin: {
    borderRadius: 30,
    padding: 5,
    borderWidth: 2,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
});
