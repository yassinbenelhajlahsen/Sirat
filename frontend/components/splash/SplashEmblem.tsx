import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Polygon } from "react-native-svg";

export const SPLASH_ARABIC_FONT = "Amiri";

// Khatam: the {8/2} star polygon, two squares overlaid, as one 16-point outline
// of outer radius 50 around the origin.
const OUTER = 50;
const INNER = OUTER * 0.7654;
const STAR_POINTS = Array.from({ length: 16 }, (_, i) => {
  const r = i % 2 === 0 ? OUTER : INNER;
  const a = (i * Math.PI) / 8 - Math.PI / 2;
  return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
}).join(" ");
const RING_RADIUS = 31;

// Dash lengths just over each outline's perimeter, so offset == length is
// fully hidden and 0 is fully drawn.
const STAR_LENGTH = 340;
const RING_LENGTH = 200;

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  size: number;
  color: string;
  star: SharedValue<number>;
  ring: SharedValue<number>;
  lettering: SharedValue<number>;
};

export default function SplashEmblem({ size, color, star, ring, lettering }: Props) {
  const starProps = useAnimatedProps(() => ({
    strokeDashoffset: STAR_LENGTH * (1 - star.value),
  }));
  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_LENGTH * (1 - ring.value),
  }));
  const letteringStyle = useAnimatedStyle(() => ({ opacity: lettering.value }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg style={StyleSheet.absoluteFill} viewBox="-52 -52 104 104">
        <AnimatedPolygon
          points={STAR_POINTS}
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          strokeDasharray={STAR_LENGTH}
          animatedProps={starProps}
        />
        <AnimatedCircle
          cx={0}
          cy={0}
          r={RING_RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={1}
          strokeOpacity={0.7}
          strokeDasharray={RING_LENGTH}
          animatedProps={ringProps}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Animated.Text
          testID="splash-emblem-text"
          allowFontScaling={false}
          style={[
            {
              fontFamily: SPLASH_ARABIC_FONT,
              fontSize: size * 0.3,
              lineHeight: size * 0.5,
              color: color,
              includeFontPadding: false,
            },
            letteringStyle,
          ]}
        >
          صراط
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
});
