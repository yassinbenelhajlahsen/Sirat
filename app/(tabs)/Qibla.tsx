import { Text, View } from "react-native";

export default function Qibla() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
                  padding: 20

      }}
    >
      <Text style={{ color: "white" }}>Qibla page. Will show qibla compass direction.</Text>
    </View>

  );
}

