import { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  Text,
  View,
  StyleProp,
  ViewStyle,
} from "react-native";
import { PrayerTime } from "../services/yearlyPrayerTimes";

function Skeleton({
  width = "100%",
  height = 24,
  style = {},
}: {
  width?: string | number;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const shimmer = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [shimmer]);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 300],
  });

  return (
    <View
      style={[
        {
          backgroundColor: "#184d1a",
          borderRadius: 8,
          overflow: "hidden",
          width,
          height,
          marginBottom: 12,
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          width: "60%",
          height: "100%",
          backgroundColor: "#236c2a",
          opacity: 0.5,
          transform: [{ translateX }],
        }}
      />
    </View>
  );
}

export default function PrayerTimesList({
  loading,
  prayerTimes,
  nextPrayerLabel,
}: {
  loading: boolean;
  prayerTimes: PrayerTime[];
  nextPrayerLabel?: string | null;
}) {
  if (loading) {
    return (
      <View>
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} height={28} style={{ width: "100%" }} />
        ))}
      </View>
    );
  }

  return (
    <View>
      {prayerTimes.map(({ label, time }) => {
        const isNext = nextPrayerLabel === label;
        return (
          <View
            key={label}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: isNext ? "#1b5e11" : "transparent",
              borderColor: isNext ? "#DABA69" : "transparent",
              borderWidth: isNext ? 2 : 0,
              borderRadius: 12,
              paddingVertical: 12,
              paddingHorizontal: 12,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: "white", fontSize: 20 }}>{label}</Text>
            <Text style={{ color: "white", fontSize: 20 }}>{time}</Text>
          </View>
        );
      })}
    </View>
  );
}
