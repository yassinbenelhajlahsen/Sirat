import { fireEvent, render } from "@testing-library/react-native";
import HabitChecklist from "@/components/tracking/HabitChecklist";
import { ThemeProvider } from "@/context/ThemeContext";
import type { Habit } from "@/services/habitTracker";

const habits: Habit[] = [
  { id: "h1", name: "Read Qur'an", icon: "book-outline", frequency: { type: "daily" }, order: 0, archived: false, createdAtKey: "2026-06-01", updatedAt: 1 },
];
const thursday = new Date(2026, 5, 18); // 2026-06-18 is a Thursday
const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("HabitChecklist", () => {
  it("toggles a habit", () => {
    const onToggle = jest.fn();
    const { getByLabelText } = render(
      wrap(<HabitChecklist habits={habits} done={{}} date={thursday} onToggle={onToggle} />),
    );
    fireEvent.press(getByLabelText("Toggle Read Qur'an"));
    expect(onToggle).toHaveBeenCalledWith("h1");
  });

  it("renders nothing when there are no habits", () => {
    const { queryByText } = render(
      wrap(<HabitChecklist habits={[]} done={{}} date={thursday} onToggle={jest.fn()} />),
    );
    expect(queryByText("Habits")).toBeNull();
  });

  it("hides a weekly habit on a non-scheduled day", () => {
    const weekly: Habit[] = [
      { id: "w1", name: "Fast", icon: "restaurant-outline", frequency: { type: "weekly", days: [4] }, order: 0, archived: false, createdAtKey: "2026-06-01", updatedAt: 1 },
    ];
    const tue = new Date(2026, 5, 16); // Tuesday
    const { queryByText } = render(wrap(<HabitChecklist habits={weekly} done={{}} date={tue} onToggle={jest.fn()} />));
    expect(queryByText("Fast")).toBeNull();
    expect(queryByText("Habits")).toBeNull(); // nothing due -> card hidden
  });

  it("shows a weekly habit on its scheduled day", () => {
    const weekly: Habit[] = [
      { id: "w1", name: "Fast", icon: "restaurant-outline", frequency: { type: "weekly", days: [4] }, order: 0, archived: false, createdAtKey: "2026-06-01", updatedAt: 1 },
    ];
    const { getByText } = render(wrap(<HabitChecklist habits={weekly} done={{}} date={thursday} onToggle={jest.fn()} />));
    expect(getByText("Fast")).toBeTruthy();
  });
});
