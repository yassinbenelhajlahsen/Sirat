// frontend/__tests__/screens/Tracker.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import Tracker from "@/app/Tracker";
import { ThemeProvider } from "@/context/ThemeContext";

jest.mock("@gorhom/bottom-sheet", () => {
  const { View, TextInput } = require("react-native");
  const Comp = ({ children }: any) => <View>{children}</View>;
  return { __esModule: true, default: Comp, BottomSheetView: Comp, BottomSheetTextInput: TextInput };
});
// react-native-svg is already mocked globally in jest.setup.ts via a Proxy
// that handles Svg, Defs, RadialGradient, Rect, Stop and all other exports.
// The local override in the brief was incomplete (missing Aurora's Defs/etc),
// so we rely on the global setup mock instead.
jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});
const mockBack = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ back: mockBack, push: jest.fn() }) }));

jest.mock("@/hooks/useTrackingStats", () => ({
  useTrackingStats: () => ({
    streak: 12,
    completion: { overall: 0.8, byPrayer: { fajr: 0.8, dhuhr: 0.9, asr: 0.7, maghrib: 1, isha: 0.6 } },
    qada: 7,
    dailyScores: Array.from({ length: 30 }, () => 0.5),
    year: 2026,
    monthIndex0: 5,
  }),
}));
jest.mock("@/hooks/useHabits", () => ({
  useHabits: () => ({
    habits: [
      { id: "h1", name: "Read Qur'an", icon: "book-outline", frequency: { type: "daily" }, order: 0, archived: false, createdAtKey: "2026-06-01", updatedAt: 1 },
    ],
    create: jest.fn(),
    update: jest.fn(),
    archive: jest.fn(),
    remove: jest.fn(),
    reorder: jest.fn(),
  }),
}));
jest.mock("@/hooks/useHabitLog", () => ({ useHabitLogAll: () => ({}) }));

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("Tracker screen", () => {
  it("renders the streak hero, qada and a habit", () => {
    const { getByText } = render(wrap(<Tracker />));
    expect(getByText("12")).toBeTruthy();
    expect(getByText("Qada")).toBeTruthy();
    expect(getByText("Read Qur'an")).toBeTruthy();
  });

  it("back button calls router.back", () => {
    const { getByLabelText } = render(wrap(<Tracker />));
    fireEvent.press(getByLabelText("Go back"));
    expect(mockBack).toHaveBeenCalled();
  });
});
