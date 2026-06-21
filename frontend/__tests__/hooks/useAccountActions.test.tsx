import { renderHook, act } from "@testing-library/react-native";
import { useAccountActions } from "@/hooks/useAccountActions";

const mockSignOut = jest.fn();
const mockApiFetch = jest.fn();
jest.mock("@clerk/expo", () => ({ useAuth: () => ({ signOut: mockSignOut }) }));
jest.mock("@/services/apiClient", () => ({ apiFetch: (...a: unknown[]) => mockApiFetch(...a) }));

describe("useAccountActions", () => {
  beforeEach(() => {
    mockSignOut.mockReset().mockResolvedValue(undefined);
    mockApiFetch.mockReset().mockResolvedValue({ deleted: true });
  });

  it("signOut clears the Clerk session", async () => {
    const { result } = renderHook(() => useAccountActions());
    await act(async () => { await result.current.signOut(); });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("deleteAccount calls DELETE /api/account then signs out", async () => {
    const { result } = renderHook(() => useAccountActions());
    await act(async () => { await result.current.deleteAccount(); });
    expect(mockApiFetch).toHaveBeenCalledWith("/api/account", { method: "DELETE" });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    // DELETE must happen before signOut (token still valid for the server call)
    expect(mockApiFetch.mock.invocationCallOrder[0]).toBeLessThan(
      mockSignOut.mock.invocationCallOrder[0],
    );
  });

  it("deleteAccount does not sign out if the server call fails", async () => {
    mockApiFetch.mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useAccountActions());
    await act(async () => {
      await expect(result.current.deleteAccount()).rejects.toThrow("network");
    });
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
