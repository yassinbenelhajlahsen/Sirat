import { useEffect } from "react";
import {
  Easing,
  useSharedValue,
  withDelay,
  withTiming,
  type WithTimingConfig,
} from "react-native-reanimated";

const DRAW = Easing.bezier(0.4, 0, 0.2, 1);
const RISE = Easing.bezier(0.2, 0.8, 0.2, 1);

/** The full opening ends at about 1.3s; a repeat launch compresses it to 1s. */
const FIRST_END_MS = 1300;
const QUICK_END_MS = 1000;

/**
 * One 0..1 progress value per element of the opening. They run on the UI
 * thread, which matters because the JS thread is busy booting the app. Nothing
 * starts until `play`, so the star stays undrawn while the launch type and the
 * Arabic font are still resolving.
 */
export function useSplashChoreography(play: boolean, quick: boolean, reduceMotion: boolean) {
  const star = useSharedValue(0);
  const ring = useSharedValue(0);
  const lettering = useSharedValue(0);
  const masthead = useSharedValue(0);
  const passage = useSharedValue(0);

  useEffect(() => {
    if (!play) return;
    if (reduceMotion) {
      star.value = ring.value = lettering.value = masthead.value = passage.value = 1;
      return;
    }
    const k = quick ? QUICK_END_MS / FIRST_END_MS : 1;
    const run = (delay: number, duration: number, easing: NonNullable<WithTimingConfig["easing"]>) =>
      withDelay(delay * k, withTiming(1, { duration: duration * k, easing }));
    star.value = run(0, 900, DRAW);
    ring.value = run(250, 700, DRAW);
    lettering.value = run(650, 420, Easing.out(Easing.quad));
    masthead.value = run(450, 450, RISE);
    passage.value = run(800, 500, RISE);
  }, [play, quick, reduceMotion, star, ring, lettering, masthead, passage]);

  return { star, ring, lettering, masthead, passage };
}
