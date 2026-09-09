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

  it("describes each day for screen readers and shows a legend", () => {
    const scores = Array.from({ length: 30 }, () => 0.6);
    const { getByTestId, getByText } = render(
      wrap(<MonthHeatmap scores={scores} year={2026} monthIndex0={5} />),
    );
    expect(getByTestId("heatcell-12").props.accessibilityLabel).toBe(
      "Jun 12: 60% of prayers logged",
    );
    // The legend is decorative for screen readers (each cell already speaks
    // its value), so it is hidden from the accessibility tree on purpose.
    expect(getByText("Less", { includeHiddenElements: true })).toBeTruthy();
    expect(getByText("More", { includeHiddenElements: true })).toBeTruthy();
  });
});
