// frontend/__tests__/components/tracking/HabitEditor.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import { Alert } from "react-native";
import HabitEditor from "@/components/tracking/HabitEditor";
import { ThemeProvider } from "@/context/ThemeContext";
import type { Habit } from "@/services/habitTracker";

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
    fireEvent.press(getByLabelText("Moon icon"));
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

  it("does not submit a weekly habit with no days selected and says why", () => {
    const onSubmit = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      wrap(<HabitEditor visible initial={null} onSubmit={onSubmit} onClose={jest.fn()} />),
    );
    fireEvent.changeText(getByPlaceholderText("Habit name"), "Fast");
    fireEvent.press(getByText("Weekly"));
    expect(getByText("Pick at least one day.")).toBeTruthy();
    fireEvent.press(getByText("Save"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("confirms before deleting an existing habit", () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const onDelete = jest.fn();
    const onClose = jest.fn();
    const existing: Habit = {
      id: "h1",
      name: "Read Qur'an",
      icon: "book-outline",
      frequency: { type: "daily" },
      order: 0,
      archived: false,
      createdAtKey: "2026-06-01",
      updatedAt: 1,
    };
    const { getByLabelText } = render(
      wrap(
        <HabitEditor visible initial={existing} onSubmit={jest.fn()} onDelete={onDelete} onClose={onClose} />,
      ),
    );
    fireEvent.press(getByLabelText("Delete habit"));
    expect(onDelete).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      "Delete habit?",
      expect.stringContaining("Read Qur'an"),
      expect.arrayContaining([expect.objectContaining({ text: "Delete", style: "destructive" })]),
    );
    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === "Delete")?.onPress?.();
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    alertSpy.mockRestore();
  });
});
