import { Text, View } from "react-native";

export default function Calender() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text>Calender. This will display important dates, like holidays and allow user to press on a date to see that days prayer times.</Text>
    </View>
  );
}
