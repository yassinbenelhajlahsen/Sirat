import { Text, View, SafeAreaView, Animated, Image, StyleSheet } from "react-native";
import { useRef, useEffect } from "react";
import useQibla from "../lib/useQibla";

export default function Qibla() {
  const { rotation, error } = useQibla();

  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (rotation !== null) {
      Animated.timing(rotateAnim, {
        toValue: rotation,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [rotation]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
  });

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
          <View style={styles.arrowGlow}>
            <Animated.Image
              source={require("../../assets/images/qibla_arrow.png")}
              style={[styles.arrow, { transform: [{ rotate: spin }] }]}
              resizeMode="contain"
            />
          </View>
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
  arrowGlow: {
    padding: 10,
    borderRadius: 200,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    shadowColor: "#00ffcc",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 15,
  },
  arrow: {
    width: 300,
    height: 300,
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
