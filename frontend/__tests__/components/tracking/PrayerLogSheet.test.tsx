// frontend/__tests__/components/tracking/PrayerLogSheet.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import PrayerLogSheet from "@/components/tracking/PrayerLogSheet";
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

describe("PrayerLogSheet", () => {
  it("fires onSelect with the chosen status", () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      wrap(
        <PrayerLogSheet
          visible
          prayerName="dhuhr"
          prayerLabel="Dhuhr"
          onSelect={onSelect}
          onClear={jest.fn()}
          onClose={jest.fn()}
        />,
      ),
    );
    fireEvent.press(getByText("Late"));
    expect(onSelect).toHaveBeenCalledWith("late");
  });

  it("shows Clear only when a status is set and fires onClear", () => {
    const onClear = jest.fn();
    const { queryByText, rerender } = render(
      wrap(
        <PrayerLogSheet visible prayerName="fajr" prayerLabel="Fajr" onSelect={jest.fn()} onClear={onClear} onClose={jest.fn()} />,
      ),
    );
    expect(queryByText("Clear")).toBeNull();
    rerender(
      wrap(
        <PrayerLogSheet visible prayerName="fajr" prayerLabel="Fajr" currentStatus="prayed" onSelect={jest.fn()} onClear={onClear} onClose={jest.fn()} />,
      ),
    );
    fireEvent.press(queryByText("Clear")!);
    expect(onClear).toHaveBeenCalled();
  });
});
