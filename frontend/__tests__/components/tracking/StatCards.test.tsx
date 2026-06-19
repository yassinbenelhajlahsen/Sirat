import { render } from "@testing-library/react-native";
import StreakHero from "@/components/tracking/StreakHero";
import QadaCard from "@/components/tracking/QadaCard";
import { ThemeProvider } from "@/context/ThemeContext";

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("StreakHero", () => {
  it("shows the streak numeral and label", () => {
    const { getByText } = render(wrap(<StreakHero streak={12} />));
    expect(getByText("12")).toBeTruthy();
    expect(getByText("DAY STREAK")).toBeTruthy();
  });
});

describe("QadaCard", () => {
  it("shows the qada count and title", () => {
    const { getByText } = render(wrap(<QadaCard count={7} />));
    expect(getByText("7")).toBeTruthy();
    expect(getByText("Qada")).toBeTruthy();
  });
});
