import { Text, View } from "react-native";

export default function Calendar() {
  return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 20
        }}
      >
        <Text style={{ color: "white" }}>
          Calendar. This will display important dates, like holidays and allow
          user to press on a date to see that days prayer times.
        </Text>
      </View>
  );
}
