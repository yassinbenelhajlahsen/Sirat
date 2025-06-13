import { Text, View } from "react-native";

export default function PrayerTimes() {
  return (

    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
                  padding: 20

      }}
    >
      <Text style={{ color: "white" }}>Prayer times. This will display todays prayer times and allow user to see past month and year in the future.</Text>
    </View>

  );
}
