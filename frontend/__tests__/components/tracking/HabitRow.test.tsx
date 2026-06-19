// frontend/__tests__/components/tracking/HabitRow.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import HabitRow from "@/components/tracking/HabitRow";
import { frequencyLabel } from "@/utils/habitFrequency";
import { ThemeProvider } from "@/context/ThemeContext";
import type { Habit } from "@/services/habitTracker";

const habit: Habit = {
  id: "h1",
  name: "Read Qur'an",
  icon: "book-outline",
  frequency: { type: "weekly", days: [1, 4] },
  order: 0,
  archived: false,
  createdAtKey: "2026-06-01",
  updatedAt: 1,
};

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("frequencyLabel", () => {
  it("formats daily and weekly", () => {
    expect(frequencyLabel({ type: "daily" })).toBe("Daily");
    expect(frequencyLabel({ type: "weekly", days: [1, 4] })).toBe("Mon, Thu");
  });
});

describe("HabitRow", () => {
  it("renders name, frequency, streak and fires actions", () => {
    const onArchive = jest.fn();
    const onEdit = jest.fn();
    const { getByText, getByLabelText } = render(
      wrap(
        <HabitRow
          habit={habit}
          streak={5}
          canMoveUp
          canMoveDown
          onMoveUp={jest.fn()}
          onMoveDown={jest.fn()}
          onEdit={onEdit}
          onArchive={onArchive}
        />,
      ),
    );
    expect(getByText("Read Qur'an")).toBeTruthy();
    expect(getByText("Mon, Thu")).toBeTruthy();
    fireEvent.press(getByLabelText("Archive Read Qur'an"));
    expect(onArchive).toHaveBeenCalled();
    fireEvent.press(getByLabelText("Edit Read Qur'an"));
    expect(onEdit).toHaveBeenCalled();
  });
});
