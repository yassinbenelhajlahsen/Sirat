import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { defaultTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import SignIn from "@/app/SignIn";

const mockStartSSOFlow = jest.fn();
const mockSetActive = jest.fn();
const mockBack = jest.fn();
const mockStartApple = jest.fn();

jest.mock("@clerk/expo", () => ({
  useSSO: () => ({ startSSOFlow: mockStartSSOFlow }),
}));
jest.mock("@clerk/expo/apple", () => ({
  useSignInWithApple: () => ({ startAppleAuthenticationFlow: mockStartApple }),
}));
jest.mock("@/hooks/useAuthState", () => ({
  useAuthState: () => ({ isLoaded: true, isSignedIn: false, userId: null, email: null }),
}));
jest.mock("@/context/ThemeContext", () => ({
  useTheme: jest.fn(),
}));
jest.mock("expo-router", () => ({ router: { back: () => mockBack(), replace: jest.fn() } }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: any) => children,
  SafeAreaProvider: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
}));
jest.mock("expo-auth-session", () => ({
  makeRedirectUri: jest.fn(() => "sirat://sso-callback"),
}));

const mockUseTheme = useTheme as jest.Mock;

describe("SignIn screen", () => {
  beforeEach(() => {
    mockStartSSOFlow.mockReset();
    mockSetActive.mockReset();
    mockBack.mockReset();
    mockStartApple.mockReset();
    mockUseTheme.mockReturnValue({ theme: defaultTheme });
  });

  it("renders Apple and Google options on iOS", () => {
    // jest-expo defaults Platform.OS to "ios"
    const { getByText } = render(<SignIn />);
    expect(getByText("Continue with Apple")).toBeTruthy();
    expect(getByText("Continue with Google")).toBeTruthy();
  });

  it("starts the Google SSO flow and activates the session", async () => {
    mockStartSSOFlow.mockResolvedValue({ createdSessionId: "sess_1", setActive: mockSetActive });
    const { getByText } = render(<SignIn />);
    fireEvent.press(getByText("Continue with Google"));
    await waitFor(() => expect(mockStartSSOFlow).toHaveBeenCalledTimes(1));
    expect(mockStartSSOFlow).toHaveBeenCalledWith(
      expect.objectContaining({ strategy: "oauth_google" }),
    );
    await waitFor(() => expect(mockSetActive).toHaveBeenCalledWith({ session: "sess_1" }));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it("calls startAppleAuthenticationFlow and activates the session on Apple sign-in", async () => {
    mockStartApple.mockResolvedValue({ createdSessionId: "sess_2", setActive: mockSetActive });
    const { getByText } = render(<SignIn />);
    fireEvent.press(getByText("Continue with Apple"));
    await waitFor(() => expect(mockStartApple).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockSetActive).toHaveBeenCalledWith({ session: "sess_2" }));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it("silently returns when Apple sign-in is cancelled", async () => {
    const cancelError = Object.assign(new Error("Cancelled"), { code: "ERR_REQUEST_CANCELED" });
    mockStartApple.mockRejectedValue(cancelError);
    const { getByText } = render(<SignIn />);
    fireEvent.press(getByText("Continue with Apple"));
    await waitFor(() => expect(mockStartApple).toHaveBeenCalledTimes(1));
    expect(mockBack).not.toHaveBeenCalled();
  });
});
