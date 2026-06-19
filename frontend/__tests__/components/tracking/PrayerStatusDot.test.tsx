import { render } from "@testing-library/react-native";
import PrayerStatusDot from "@/components/tracking/PrayerStatusDot";
import { ThemeProvider } from "@/context/ThemeContext";

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("PrayerStatusDot", () => {
  it("renders a prayed dot", () => {
    const { getByTestId } = render(wrap(<PrayerStatusDot status="prayed" loggable />));
    expect(getByTestId("dot-prayed")).toBeTruthy();
  });
  it("renders late and missed dots", () => {
    expect(render(wrap(<PrayerStatusDot status="late" loggable />)).getByTestId("dot-late")).toBeTruthy();
    expect(render(wrap(<PrayerStatusDot status="missed" loggable />)).getByTestId("dot-missed")).toBeTruthy();
  });
  it("renders a dashed loggable ring when unlogged but loggable", () => {
    const { getByTestId } = render(wrap(<PrayerStatusDot loggable />));
    expect(getByTestId("dot-loggable")).toBeTruthy();
  });
  it("renders a faint upcoming dot when not loggable", () => {
    const { getByTestId } = render(wrap(<PrayerStatusDot loggable={false} />));
    expect(getByTestId("dot-upcoming")).toBeTruthy();
  });
});
