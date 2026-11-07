import { renderHook, act } from "@testing-library/react-native";
import { useAccountActions } from "@/hooks/useAccountActions";

const mockSignOut = jest.fn();
const mockApiFetch = jest.fn();
const mockClearChat = jest.fn();
jest.mock("@clerk/expo", () => ({ useAuth: () => ({ signOut: mockSignOut }) }));
jest.mock("@/services/apiClient", () => ({ apiFetch: (...a: unknown[]) => mockApiFetch(...a) }));
jest.mock("@/services/chat/chatStore", () => ({ clearChat: (...a: unknown[]) => mockClearChat(...a) }));

describe("useAccountActions", () => {
  beforeEach(() => {
    mockSignOut.mockReset().mockResolvedValue(undefined);
    mockApiFetch.mockReset().mockResolvedValue({ deleted: true });
    mockClearChat.mockReset().mockResolvedValue(undefined);
  });

  it("signOut clears the chat, then the Clerk session", async () => {
    const { result } = renderHook(() => useAccountActions());
    await act(async () => { await result.current.signOut(); });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockClearChat).toHaveBeenCalledTimes(1);
    expect(mockClearChat.mock.invocationCallOrder[0]).toBeLessThan(
      mockSignOut.mock.invocationCallOrder[0],
    );
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

  it("deleteAccount clears the chat before signing out", async () => {
    const { result } = renderHook(() => useAccountActions());
    await act(async () => { await result.current.deleteAccount(); });
    expect(mockClearChat).toHaveBeenCalledTimes(1);
    expect(mockClearChat.mock.invocationCallOrder[0]).toBeLessThan(
      mockSignOut.mock.invocationCallOrder[0],
    );
  });

  it("deleteAccount does not sign out or clear the chat if the server call fails", async () => {
    mockApiFetch.mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useAccountActions());
    await act(async () => {
      await expect(result.current.deleteAccount()).rejects.toThrow("network");
    });
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockClearChat).not.toHaveBeenCalled();
  });
});
