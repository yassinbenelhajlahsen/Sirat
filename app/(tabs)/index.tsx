import { Text,View } from "react-native";

export default function Home() {
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
        Homescreen. This will display today's prayer times and a daily dua.
        Scroll down to see a mosque map.
      </Text>
    </View> 
  );
}
