// frontend/__tests__/components/calendar/MonthPickerSheet.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import MonthPickerSheet from "@/components/calendar/MonthPickerSheet";
import { ThemeProvider } from "@/context/ThemeContext";

jest.mock("@gorhom/bottom-sheet", () => {
  const { View } = require("react-native");
  const Comp = ({ children }: any) => <View>{children}</View>;
  return { __esModule: true, default: Comp, BottomSheetView: Comp };
});
jest.mock("@gorhom/portal", () => ({ Portal: ({ children }: any) => children }));
jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

const baseProps = {
  visible: true,
  viewYear: 2026,
  viewMonth: 7,
  today: new Date(2026, 4, 15),
  minDate: new Date(2025, 0),
  maxDate: new Date(2028, 11),
  onSelect: jest.fn(),
  onClose: jest.fn(),
};

describe("MonthPickerSheet", () => {
  it("renders every year in range and all twelve months", () => {
    const { getByText } = render(wrap(<MonthPickerSheet {...baseProps} />));
    expect(getByText("2025")).toBeTruthy();
    expect(getByText("2026")).toBeTruthy();
    expect(getByText("2027")).toBeTruthy();
    expect(getByText("2028")).toBeTruthy();
    expect(getByText("Jan")).toBeTruthy();
    expect(getByText("Dec")).toBeTruthy();
  });

  it("fires onSelect with the chosen year and month", () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      wrap(<MonthPickerSheet {...baseProps} onSelect={onSelect} />),
    );
    fireEvent.press(getByText("Mar"));
    expect(onSelect).toHaveBeenCalledWith(2026, 2);
  });

  it("selects months in the other year after switching the year pill", () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      wrap(<MonthPickerSheet {...baseProps} onSelect={onSelect} />),
    );
    fireEvent.press(getByText("2027"));
    fireEvent.press(getByText("Jun"));
    expect(onSelect).toHaveBeenCalledWith(2027, 5);
  });

  it("marks today's month and year distinctly from the selected month", () => {
    const { getByLabelText } = render(wrap(<MonthPickerSheet {...baseProps} />));

    const thisMonth = getByLabelText("May 2026, current month");
    expect(thisMonth.props.accessibilityState.selected).toBe(false);

    const selectedMonth = getByLabelText("Aug 2026");
    expect(selectedMonth.props.accessibilityState.selected).toBe(true);

    expect(getByLabelText("Show months of 2026, current year")).toBeTruthy();
  });

  it("disables months outside the allowed range", () => {
    const onSelect = jest.fn();
    const { getByLabelText } = render(
      wrap(
        <MonthPickerSheet
          {...baseProps}
          minDate={new Date(2026, 2)}
          onSelect={onSelect}
        />,
      ),
    );
    const january = getByLabelText("Jan 2026");
    expect(january.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(january);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
