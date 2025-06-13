import { Text, View } from "react-native";
export default function Settings() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
                  padding: 20

      }}
    >
      <Text style={{ color: "white" }}>Settings. This will display app settings like setting city and turning location services on/off.</Text>
    </View>
  );
}
