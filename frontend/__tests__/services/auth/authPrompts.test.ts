const mockGetItem = jest.fn();
const mockSetItem = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (...args: unknown[]) => mockGetItem(...args),
    setItem: (...args: unknown[]) => mockSetItem(...args),
  },
}));

import { isHomeCardDismissed, dismissHomeCard, shouldShowHomeCard, markHomeCardShown } from "@/services/auth/authPrompts";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

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

  describe("shouldShowHomeCard", () => {
    let dateSpy: jest.SpyInstance;

    beforeEach(() => {
      dateSpy = jest.spyOn(Date, "now").mockReturnValue(NOW);
    });

    afterEach(() => {
      dateSpy.mockRestore();
    });

    it("returns false when card is permanently dismissed", async () => {
      // dismissed key = "1", short-circuits before checking last-shown
      mockGetItem.mockResolvedValue("1");
      await expect(shouldShowHomeCard()).resolves.toBe(false);
    });

    it("returns true when never shown (no lastShown key)", async () => {
      // dismissed key → null, lastShown key → null
      mockGetItem
        .mockResolvedValueOnce(null)  // isHomeCardDismissed → not dismissed
        .mockResolvedValueOnce(null); // HOME_CARD_LAST_SHOWN_KEY → never set
      await expect(shouldShowHomeCard()).resolves.toBe(true);
    });

    it("returns false when lastShown is recent (< 3 days ago)", async () => {
      const recentTs = NOW - THREE_DAYS_MS + 1000; // just under 3 days
      mockGetItem
        .mockResolvedValueOnce(null)              // not dismissed
        .mockResolvedValueOnce(String(recentTs)); // lastShown is recent
      await expect(shouldShowHomeCard()).resolves.toBe(false);
    });

    it("returns true when lastShown is old (>= 3 days ago)", async () => {
      const oldTs = NOW - THREE_DAYS_MS;
      mockGetItem
        .mockResolvedValueOnce(null)          // not dismissed
        .mockResolvedValueOnce(String(oldTs)); // exactly 3 days ago
      await expect(shouldShowHomeCard()).resolves.toBe(true);
    });

    it("returns false when AsyncStorage throws", async () => {
      mockGetItem.mockRejectedValue(new Error("storage error"));
      await expect(shouldShowHomeCard()).resolves.toBe(false);
    });
  });

  describe("markHomeCardShown", () => {
    it("writes current timestamp to the last-shown key", async () => {
      const dateSpy = jest.spyOn(Date, "now").mockReturnValue(NOW);
      mockSetItem.mockResolvedValue(undefined);
      await markHomeCardShown();
      expect(mockSetItem).toHaveBeenCalledWith("auth:home_card_last_shown_v1", String(NOW));
      dateSpy.mockRestore();
    });

    it("does not throw when AsyncStorage throws", async () => {
      mockSetItem.mockRejectedValue(new Error("storage error"));
      await expect(markHomeCardShown()).resolves.toBeUndefined();
    });
  });
});
