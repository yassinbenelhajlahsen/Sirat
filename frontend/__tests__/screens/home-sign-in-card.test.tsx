// frontend/__tests__/screens/home-sign-in-card.test.tsx
import { act, render } from "@testing-library/react-native";
import Home from "@/app/(tabs)/index";
import { ThemeProvider } from "@/context/ThemeContext";

const signedOut = { isLoaded: true, isSignedIn: false, userId: null, email: null };
const signedIn = { isLoaded: true, isSignedIn: true, userId: "u1", email: null };
let mockAuth: typeof signedOut | typeof signedIn = signedOut;
const mockShouldShow = jest.fn();

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }), useIsFocused: () => true }));
jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock("@/hooks/useAuthState", () => ({ useAuthState: () => mockAuth }));
jest.mock("@/services/auth/authPrompts", () => ({
  isHomeCardDismissed: () => Promise.resolve(false),
  dismissHomeCard: () => Promise.resolve(),
  shouldShowHomeCard: () => mockShouldShow(),
  markHomeCardShown: () => Promise.resolve(),
}));
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
    streak: 0,
    completion: { overall: 0, byPrayer: { Fajr: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0 } },
    qada: 0, dailyScores: [], year: 2026, monthIndex0: 5,
  }),
}));

const CARD = "Sign in to sync";
const home = () => <ThemeProvider><Home /></ThemeProvider>;
const settle = () => act(async () => { await Promise.resolve(); });

describe("Home sign-in card", () => {
  beforeEach(() => {
    mockAuth = signedOut;
    mockShouldShow.mockReset().mockResolvedValue(true);
  });

  it("shows while signed out", async () => {
    const { findByLabelText } = render(home());
    expect(await findByLabelText(CARD)).toBeTruthy();
  });

  it("hides as soon as the user signs in, without leaving Home", async () => {
    const { findByLabelText, queryByLabelText, rerender } = render(home());
    await findByLabelText(CARD);

    mockAuth = signedIn;
    rerender(home());
    await settle();

    expect(queryByLabelText(CARD)).toBeNull();
  });

  it("does not come back on sign-out inside the 3-day quiet period", async () => {
    const { findByLabelText, queryByLabelText, rerender } = render(home());
    await findByLabelText(CARD);

    mockAuth = signedIn;
    rerender(home());
    await settle();

    mockShouldShow.mockResolvedValue(false);
    mockAuth = signedOut;
    rerender(home());
    await settle();

    expect(queryByLabelText(CARD)).toBeNull();
  });
});
