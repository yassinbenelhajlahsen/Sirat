import { render } from "@testing-library/react-native";

import SplashAtmosphere, {
  HORIZON_OPACITY,
  VIGNETTE_OPACITY,
} from "@/components/SplashAtmosphere";
import { AURORA_ACCENT_OPACITY } from "@/components/ui/Aurora";
import { ThemeProvider } from "@/context/ThemeContext";

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("SplashAtmosphere", () => {
  it("renders without crashing", () => {
    expect(() => render(wrap(<SplashAtmosphere />))).not.toThrow();
  });

  // The splash is the only screen that can afford a real atmosphere: the in-app
  // Aurora stays faint because content has to remain readable on top of it, and
  // the splash has no content to protect. Keep that relationship explicit so a
  // future tweak to one doesn't quietly invert it.
  it("carries further than the in-app Aurora", () => {
    expect(HORIZON_OPACITY).toBeGreaterThan(AURORA_ACCENT_OPACITY);
  });

  it("keeps the vignette a deepening rather than a curtain", () => {
    expect(VIGNETTE_OPACITY).toBeLessThan(0.3);
    expect(VIGNETTE_OPACITY).toBeGreaterThan(0);
  });
});
