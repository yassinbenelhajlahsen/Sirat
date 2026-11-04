// frontend/__tests__/screens/Duas.test.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import Duas from "@/app/Duas";
import DuaTopic from "@/app/DuaTopic";
import { ThemeProvider } from "@/context/ThemeContext";
import { getDuaById } from "@/services/duaService";

jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
}));

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

beforeEach(async () => {
  await AsyncStorage.clear();
  mockParams = {};
});

describe("Duas library screen", () => {
  it("shows the ask box, the Saved empty state and topics for a fresh user", async () => {
    const { getByText, queryByText } = render(wrap(<Duas />));

    expect(getByText("Ask for a dua")).toBeTruthy();
    expect(getByText("Tap the bookmark on a dua to keep it here.")).toBeTruthy();
    expect(getByText("Illness and healing")).toBeTruthy();
    expect(getByText("TRAVEL AND HOME")).toBeTruthy();
    await waitFor(() => expect(queryByText("RECENT")).toBeNull());
  });

  it("lists saved and recent duas when there are some", async () => {
    const saved = getDuaById(1)!;
    const recent = getDuaById(2)!;
    await AsyncStorage.setItem("dua_saved_v1", JSON.stringify([saved.id, 99999]));
    await AsyncStorage.setItem("dua_history_v1", JSON.stringify([recent]));

    const { findByText, queryByText } = render(wrap(<Duas />));

    expect(await findByText("SAVED")).toBeTruthy();
    expect(await findByText(saved.english)).toBeTruthy();
    expect(await findByText("RECENT")).toBeTruthy();
    expect(await findByText(recent.english)).toBeTruthy();
    expect(queryByText("Tap the bookmark on a dua to keep it here.")).toBeNull();
  });

  it("opens a topic and a dua", async () => {
    const saved = getDuaById(1)!;
    await AsyncStorage.setItem("dua_saved_v1", JSON.stringify([saved.id]));
    const { getByLabelText, findByLabelText } = render(wrap(<Duas />));

    fireEvent.press(getByLabelText(/^Illness and healing, \d+ duas$/));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/DuaTopic",
      params: { topic: "illness-healing" },
    });

    fireEvent.press(await findByLabelText(`Open dua: ${saved.english}`));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/DuaView",
      params: { id: String(saved.id) },
    });
  });
});

describe("DuaTopic screen", () => {
  it("lists the duas of the topic", () => {
    mockParams = { topic: "illness-healing" };
    const healing = getDuaById(
      require("../../assets/data/duas.json").duas.find(
        (d: { category: string }) => d.category === "healing",
      ).id,
    )!;

    const { getByText } = render(wrap(<DuaTopic />));

    expect(getByText(healing.english)).toBeTruthy();
  });
});
