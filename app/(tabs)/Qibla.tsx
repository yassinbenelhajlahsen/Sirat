import { Text, View, SafeAreaView, Image, StyleSheet } from "react-native";
import useQibla from "../lib/useQibla"; 
export default function Qibla() {
  const { rotation, error } = useQibla();

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Title */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Qibla</Text>
      </View>

      {/* Qibla Arrow */}
      <View style={styles.arrowContainer}>
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : rotation === null ? (
          <Text style={styles.loadingText}>Finding direction...</Text>
        ) : (
          <Image
            source={require("../../assets/images/qibla_arrow.png")}
            style={[styles.arrow, { transform: [{ rotate: `${rotation}deg` }] }]}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0c3605",
  },
  titleContainer: {
    paddingTop: 10,
    paddingLeft: 20,
  },
  title: {
    color: "white",
    fontFamily: "SFProDisplay-Bold",
    fontSize: 45,
  },
  arrowContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  arrow: {
    width: 150,
    height: 150,
  },
  loadingText: {
    color: "white",
    fontSize: 18,
  },
  errorText: {
    color: "#ff7070",
    fontSize: 16,
    paddingHorizontal: 20,
    textAlign: "center",
  },
});
