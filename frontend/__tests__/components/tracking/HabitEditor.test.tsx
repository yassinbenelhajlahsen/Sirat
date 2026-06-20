// frontend/__tests__/components/tracking/HabitEditor.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import HabitEditor from "@/components/tracking/HabitEditor";
import { ThemeProvider } from "@/context/ThemeContext";

jest.mock("@gorhom/bottom-sheet", () => {
  const { View, TextInput } = require("react-native");
  const Comp = ({ children }: any) => <View>{children}</View>;
  return { __esModule: true, default: Comp, BottomSheetView: Comp, BottomSheetTextInput: TextInput };
});
jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("HabitEditor", () => {
  it("creates a daily habit from name + icon", () => {
    const onSubmit = jest.fn();
    const { getByPlaceholderText, getByLabelText, getByText } = render(
      wrap(<HabitEditor visible initial={null} onSubmit={onSubmit} onClose={jest.fn()} />),
    );
    fireEvent.changeText(getByPlaceholderText("Habit name"), "Morning adhkar");
    fireEvent.press(getByLabelText("Choose icon moon-outline"));
    fireEvent.press(getByText("Save"));
    expect(onSubmit).toHaveBeenCalledWith({
      name: "Morning adhkar",
      icon: "moon-outline",
      frequency: { type: "daily" },
    });
  });

  it("builds a weekly frequency from selected weekdays", () => {
    const onSubmit = jest.fn();
    const { getByPlaceholderText, getByText, getByLabelText } = render(
      wrap(<HabitEditor visible initial={null} onSubmit={onSubmit} onClose={jest.fn()} />),
    );
    fireEvent.changeText(getByPlaceholderText("Habit name"), "Fast");
    fireEvent.press(getByText("Weekly"));
    fireEvent.press(getByLabelText("Toggle Mon"));
    fireEvent.press(getByLabelText("Toggle Thu"));
    fireEvent.press(getByText("Save"));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Fast", frequency: { type: "weekly", days: [1, 4] } }),
    );
  });

  it("does not submit a weekly habit with no days selected", () => {
    const onSubmit = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      wrap(<HabitEditor visible initial={null} onSubmit={onSubmit} onClose={jest.fn()} />),
    );
    fireEvent.changeText(getByPlaceholderText("Habit name"), "Fast");
    fireEvent.press(getByText("Weekly"));
    fireEvent.press(getByText("Save"));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
