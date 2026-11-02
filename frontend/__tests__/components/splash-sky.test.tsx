import { render } from "@testing-library/react-native";
import type { SharedValue } from "react-native-reanimated";

import SplashSky, { GLOW_OPACITY, STAR_LAYERS } from "@/components/splash/SplashSky";
import { darkTheme } from "@/constants/theme";

describe("SplashSky", () => {
  // Each layer twinkles on one looping value, so the layer count is the cost of
  // the effect on a JS thread that is busy at app start.
  it("keeps the twinkle to a few layers", () => {
    expect(STAR_LAYERS.length).toBeGreaterThanOrEqual(3);
    expect(STAR_LAYERS.length).toBeLessThanOrEqual(4);
  });

  it("places every star inside the screen, as percentages", () => {
    for (const layer of STAR_LAYERS) {
      expect(layer.stars.length).toBeGreaterThan(0);
      for (const star of layer.stars) {
        expect(star.x).toBeGreaterThanOrEqual(0);
        expect(star.x).toBeLessThanOrEqual(100);
        expect(star.y).toBeGreaterThanOrEqual(0);
        expect(star.y).toBeLessThanOrEqual(100);
        expect(star.size).toBeGreaterThanOrEqual(1);
        expect(star.size).toBeLessThanOrEqual(2);
      }
    }
  });

  it("renders one view per star", () => {
    const { getAllByTestId } = render(
      <SplashSky theme={darkTheme} reduceMotion={false} />,
    );
    const total = STAR_LAYERS.reduce((n, l) => n + l.stars.length, 0);
    expect(getAllByTestId("splash-star")).toHaveLength(total);
  });

  it("draws no horizon glow unless given one to follow", () => {
    const { queryByTestId } = render(<SplashSky theme={darkTheme} reduceMotion={false} />);
    expect(queryByTestId("splash-glow-focused")).toBeNull();
    expect(queryByTestId("splash-glow-soft")).toBeNull();
  });

  it("draws the glow variant it is given", () => {
    const progress = { value: 1 } as SharedValue<number>;
    for (const variant of ["focused", "soft"] as const) {
      const view = render(
        <SplashSky theme={darkTheme} reduceMotion={false} glow={{ progress, variant }} />,
      );
      expect(view.getByTestId(`splash-glow-${variant}`)).toBeTruthy();
      view.unmount();
    }
  });

  // The focused glow sits under the hadith. With no text there it looked like a
  // smudge, so the repeat splash gets a quieter, wider one.
  it("keeps the soft glow dimmer than the focused one", () => {
    expect(GLOW_OPACITY.soft).toBeLessThan(GLOW_OPACITY.focused);
  });
});
