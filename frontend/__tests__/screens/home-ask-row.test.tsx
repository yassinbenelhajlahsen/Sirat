// frontend/__tests__/screens/home-ask-row.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Home from "@/app/(tabs)/index";
import { ThemeProvider } from "@/context/ThemeContext";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }), useIsFocused: () => true }));
jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

let mockSignedIn = true;
let mockLoaded = true;
jest.mock("@/hooks/useAuthState", () => ({
  useAuthState: () => ({ isLoaded: mockLoaded, isSignedIn: mockSignedIn, userId: "u1", email: null }),
}));
jest.mock("@/services/auth/authPrompts", () => ({
  isHomeCardDismissed: () => Promise.resolve(true),
  dismissHomeCard: () => Promise.resolve(),
  shouldShowHomeCard: () => Promise.resolve(false),
  markHomeCardShown: jest.fn().mockResolvedValue(undefined),
}));
let mockChatStatus = { visible: true, remaining: 12 as number | null };
jest.mock("@/hooks/useChatStatus", () => ({
  useChatStatus: () => mockChatStatus,
}));
// The real hook runs; only the data layer is stubbed.
jest.mock("@/services/prayer-times/place", () => ({
  resolvePlace: async () => ({ coords: undefined, label: "Tunis" }),
}));
jest.mock("@/services/prayerSettings", () => ({
  getEffectivePrayerSettings: async () => ({ useLocation: false, method: 2 }),
}));
jest.mock("@/services/prayerTimes", () => ({
  getPrayerTimesToday: async () => require("@/services/prayerDay").buildPrayerDay(new Date(), [{ label: "Fajr", time: "5:12 AM" }]),
  getPrayerTimesForDate: async (_s: unknown, d: Date) => require("@/services/prayerDay").buildPrayerDay(d, []),
}));
jest.mock("@/hooks/useTrackingStats", () => ({
  useTrackingStats: () => ({
    streak: 9,
    completion: { overall: 0, byPrayer: { Fajr: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0 } },
    qada: 0, dailyScores: [], year: 2026, monthIndex0: 5,
  }),
}));

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("Home Ask row", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    mockSignedIn = true;
    mockLoaded = true;
    mockChatStatus = { visible: true, remaining: 12 };
  });

  it("is hidden along with its header when the chat is not visible", () => {
    mockChatStatus = { visible: false, remaining: null };
    const { queryByText, queryByLabelText } = render(wrap(<Home />));
    expect(queryByText("Ask a question")).toBeNull();
    expect(queryByLabelText("Ask a question")).toBeNull();
    expect(queryByText("ASK")).toBeNull();
  });

  it("shows the remaining allowance when signed in", () => {
    const { getByText, getByLabelText } = render(wrap(<Home />));
    expect(getByText("Ask a question")).toBeTruthy();
    expect(getByText("12 left")).toBeTruthy();
    expect(getByLabelText("Ask a question, 12 messages left")).toBeTruthy();
  });

  it("invites sign-in when signed out", () => {
    mockSignedIn = false;
    mockChatStatus = { visible: true, remaining: null };
    const { getByText, queryByText, getByLabelText } = render(wrap(<Home />));
    expect(getByText("Sign in to ask")).toBeTruthy();
    expect(queryByText(/left$/)).toBeNull();
    expect(getByLabelText("Ask a question")).toBeTruthy();
  });

  it("shows no allowance text while the signed-in count is still loading", () => {
    mockChatStatus = { visible: true, remaining: null };
    const { getByText, queryByText, getByLabelText } = render(wrap(<Home />));
    expect(getByText("Ask a question")).toBeTruthy();
    expect(queryByText("Sign in to ask")).toBeNull();
    expect(queryByText(/left$/)).toBeNull();
    expect(getByLabelText("Ask a question")).toBeTruthy();
  });

  it("pushes the Chat route when pressed", () => {
    const { getByLabelText } = render(wrap(<Home />));
    fireEvent.press(getByLabelText("Ask a question, 12 messages left"));
    expect(mockPush).toHaveBeenCalledWith("/Chat");
  });

  it("opens sign-in first, asking for the chat next, when signed out", () => {
    mockSignedIn = false;
    mockChatStatus = { visible: true, remaining: null };
    const { getByLabelText } = render(wrap(<Home />));
    fireEvent.press(getByLabelText("Ask a question"));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/SignIn", params: { next: "Chat" } });
  });

  it("shows no sign-in text until auth has loaded", () => {
    mockLoaded = false;
    mockSignedIn = false;
    mockChatStatus = { visible: true, remaining: null };
    const { getByText, queryByText } = render(wrap(<Home />));
    expect(getByText("Ask a question")).toBeTruthy();
    expect(queryByText("Sign in to ask")).toBeNull();
  });

  it("sits between the Tracker and Dua sections", () => {
    const { getAllByRole } = render(wrap(<Home />));
    const titles = getAllByRole("header")
      .map((header) => header.props.children)
      .filter((text) => ["TRACKER", "ASK", "DUA"].includes(text));
    expect(titles).toEqual(["TRACKER", "ASK", "DUA"]);
  });
});
