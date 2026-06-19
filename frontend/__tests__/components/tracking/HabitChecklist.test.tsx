import { fireEvent, render } from "@testing-library/react-native";
import HabitChecklist from "@/components/tracking/HabitChecklist";
import { ThemeProvider } from "@/context/ThemeContext";
import type { Habit } from "@/services/habitTracker";

const habits: Habit[] = [
  { id: "h1", name: "Read Qur'an", icon: "book-outline", frequency: { type: "daily" }, order: 0, archived: false, createdAtKey: "2026-06-01", updatedAt: 1 },
];
const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("HabitChecklist", () => {
  it("toggles a habit", () => {
    const onToggle = jest.fn();
    const { getByLabelText } = render(
      wrap(<HabitChecklist habits={habits} done={{}} onToggle={onToggle} />),
    );
    fireEvent.press(getByLabelText("Toggle Read Qur'an"));
    expect(onToggle).toHaveBeenCalledWith("h1");
  });

  it("renders nothing when there are no habits", () => {
    const { queryByText } = render(wrap(<HabitChecklist habits={[]} done={{}} onToggle={jest.fn()} />));
    expect(queryByText("Habits")).toBeNull();
  });
});
