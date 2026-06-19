// frontend/__tests__/components/tracking/MonthHeatmap.test.tsx
import { render } from "@testing-library/react-native";
import MonthHeatmap from "@/components/tracking/MonthHeatmap";
import { ThemeProvider } from "@/context/ThemeContext";

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("MonthHeatmap", () => {
  it("renders a cell per day of the month with the month name", () => {
    const scores = Array.from({ length: 30 }, (_, i) => (i % 5) / 5); // June has 30 days
    const { getByTestId, getByText } = render(
      wrap(<MonthHeatmap scores={scores} year={2026} monthIndex0={5} />),
    );
    expect(getByText("June")).toBeTruthy();
    expect(getByTestId("heatcell-1")).toBeTruthy();
    expect(getByTestId("heatcell-30")).toBeTruthy();
  });
});
