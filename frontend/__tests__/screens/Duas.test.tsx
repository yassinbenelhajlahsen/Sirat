// frontend/__tests__/screens/Duas.test.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import Duas from "@/app/Duas/index";
import DuaList from "@/app/Duas/[list]";
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
  mockPush.mockClear();
});

describe("Duas sheet", () => {
  it("shows Saved and the topics, with no ask box and no Recent for a fresh user", async () => {
    const { getByText, getByLabelText, queryByText, queryByLabelText } = render(wrap(<Duas />));

    expect(queryByText("Ask for a dua")).toBeNull();
    expect(getByLabelText("Saved, 0 duas")).toBeTruthy();
    expect(getByText("Illness and healing")).toBeTruthy();
    expect(getByText("TRAVEL AND HOME")).toBeTruthy();
    await waitFor(() => expect(queryByLabelText(/^Recent,/)).toBeNull());
  });

  it("shows Recent once there is history", async () => {
    await AsyncStorage.setItem("dua_history_v1", JSON.stringify([getDuaById(2)]));
    const { findByLabelText } = render(wrap(<Duas />));
    expect(await findByLabelText("Recent, 1 duas")).toBeTruthy();
  });

  it("pushes topics, Saved and Recent inside the sheet", async () => {
    await AsyncStorage.setItem("dua_history_v1", JSON.stringify([getDuaById(2)]));
    const { getByLabelText, findByLabelText } = render(wrap(<Duas />));

    fireEvent.press(getByLabelText(/^Illness and healing, \d+ duas$/));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/Duas/[list]", params: { list: "illness-healing" } });

    fireEvent.press(getByLabelText("Saved, 0 duas"));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/Duas/[list]", params: { list: "saved" } });

    fireEvent.press(await findByLabelText("Recent, 1 duas"));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/Duas/[list]", params: { list: "recent" } });
  });
});

describe("Duas list page", () => {
  it("shows every dua of a topic in full", () => {
    mockParams = { list: "illness-healing" };
    const healing = getDuaById(
      require("../../assets/data/duas.json").duas.find(
        (d: { category: string }) => d.category === "healing",
      ).id,
    )!;

    const { getByText } = render(wrap(<DuaList />));

    expect(getByText(healing.english)).toBeTruthy();
    expect(getByText(healing.arabic)).toBeTruthy();
    expect(getByText(healing.transliteration)).toBeTruthy();
  });

  it("lists saved duas, skipping unknown ids, and saves from the list", async () => {
    const saved = getDuaById(1)!;
    await AsyncStorage.setItem("dua_saved_v1", JSON.stringify([saved.id, 99999]));
    mockParams = { list: "saved" };

    const { findByText, getByLabelText } = render(wrap(<DuaList />));

    expect(await findByText(saved.english)).toBeTruthy();
    fireEvent.press(getByLabelText("Remove from saved duas"));
    await waitFor(async () =>
      expect(JSON.parse((await AsyncStorage.getItem("dua_saved_v1"))!)).toEqual([99999]),
    );
  });

  it("shows the empty state for Saved", () => {
    mockParams = { list: "saved" };
    const { getByText } = render(wrap(<DuaList />));
    expect(getByText("Tap the bookmark on a dua to keep it here.")).toBeTruthy();
  });
});
