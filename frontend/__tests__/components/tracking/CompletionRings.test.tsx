// frontend/__tests__/components/tracking/CompletionRings.test.tsx
import { render } from "@testing-library/react-native";
import CompletionRings from "@/components/tracking/CompletionRings";
import { ThemeProvider } from "@/context/ThemeContext";

jest.mock("react-native-svg", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: View, Svg: View, Circle: View };
});

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("CompletionRings", () => {
  it("renders a ring and rounded percentage per prayer", () => {
    const { getByTestId, getByText } = render(
      wrap(
        <CompletionRings
          byPrayer={{ fajr: 0.86, dhuhr: 0.97, asr: 0.65, maghrib: 1, isha: 0.5 }}
        />,
      ),
    );
    expect(getByTestId("ring-fajr")).toBeTruthy();
    expect(getByText("86")).toBeTruthy();
    expect(getByText("100")).toBeTruthy();
  });
});
