const mockGetItem = jest.fn();
const mockSetItem = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (...args: unknown[]) => mockGetItem(...args),
    setItem: (...args: unknown[]) => mockSetItem(...args),
  },
}));

import { isHomeCardDismissed, dismissHomeCard } from "@/services/auth/authPrompts";

describe("authPrompts", () => {
  beforeEach(() => {
    mockGetItem.mockReset();
    mockSetItem.mockReset();
  });

  describe("isHomeCardDismissed", () => {
    it('returns true when stored value is "1"', async () => {
      mockGetItem.mockResolvedValue("1");
      await expect(isHomeCardDismissed()).resolves.toBe(true);
      expect(mockGetItem).toHaveBeenCalledWith("auth:home_card_dismissed_v1");
    });

    it("returns false when stored value is null", async () => {
      mockGetItem.mockResolvedValue(null);
      await expect(isHomeCardDismissed()).resolves.toBe(false);
    });

    it("returns false when stored value is some other string", async () => {
      mockGetItem.mockResolvedValue("0");
      await expect(isHomeCardDismissed()).resolves.toBe(false);
    });

    it("returns false when AsyncStorage throws", async () => {
      mockGetItem.mockRejectedValue(new Error("storage error"));
      await expect(isHomeCardDismissed()).resolves.toBe(false);
    });
  });

  describe("dismissHomeCard", () => {
    it('writes "1" to the dismissed key', async () => {
      mockSetItem.mockResolvedValue(undefined);
      await dismissHomeCard();
      expect(mockSetItem).toHaveBeenCalledWith("auth:home_card_dismissed_v1", "1");
    });

    it("does not throw when AsyncStorage throws", async () => {
      mockSetItem.mockRejectedValue(new Error("storage error"));
      await expect(dismissHomeCard()).resolves.toBeUndefined();
    });
  });
});
