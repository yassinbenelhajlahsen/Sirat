import { renderHook } from "@testing-library/react-native";
import { useAuthState } from "@/hooks/useAuthState";

const mockUseAuth = jest.fn();
const mockUseUser = jest.fn();
jest.mock("@clerk/expo", () => ({
  useAuth: () => mockUseAuth(),
  useUser: () => mockUseUser(),
}));

describe("useAuthState", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseUser.mockReset();
  });

  it("maps a signed-in Clerk state", () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: true, userId: "user_1" });
    mockUseUser.mockReturnValue({
      user: { primaryEmailAddress: { emailAddress: "a@b.com" } },
    });
    const { result } = renderHook(() => useAuthState());
    expect(result.current).toEqual({
      isLoaded: true,
      isSignedIn: true,
      userId: "user_1",
      email: "a@b.com",
    });
  });

  it("maps a signed-out state with null email", () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: false, userId: null });
    mockUseUser.mockReturnValue({ user: null });
    const { result } = renderHook(() => useAuthState());
    expect(result.current).toEqual({
      isLoaded: true,
      isSignedIn: false,
      userId: null,
      email: null,
    });
  });
});
