// frontend/__tests__/services/ratingPrompt.test.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";

import { recordVisit, VISITS_BEFORE_PROMPT } from "@/services/ratingPrompt";
import { getAppVersion } from "@/utils/appLinks";

jest.mock("expo-store-review", () => ({
  hasAction: jest.fn(async () => true),
  requestReview: jest.fn(async () => {}),
}));

jest.mock("@/utils/appLinks", () => ({ getAppVersion: jest.fn(() => "1.3.0") }));

async function visit(times: number) {
  for (let i = 0; i < times; i++) await recordVisit();
}

describe("ratingPrompt", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    (getAppVersion as jest.Mock).mockReturnValue("1.3.0");
    (StoreReview.hasAction as jest.Mock).mockResolvedValue(true);
  });

  it("asks on the 25th visit, not before", async () => {
    await visit(VISITS_BEFORE_PROMPT - 1);
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
    await visit(1);
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it("asks only once per version", async () => {
    await visit(VISITS_BEFORE_PROMPT * 3);
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it("asks again after 25 visits on a new version", async () => {
    await visit(VISITS_BEFORE_PROMPT);
    (getAppVersion as jest.Mock).mockReturnValue("1.4.0");
    await visit(VISITS_BEFORE_PROMPT - 1);
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
    await visit(1);
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(2);
  });

  it("keeps waiting when the store can't show the prompt", async () => {
    (StoreReview.hasAction as jest.Mock).mockResolvedValue(false);
    await visit(VISITS_BEFORE_PROMPT);
    expect(StoreReview.requestReview).not.toHaveBeenCalled();
    (StoreReview.hasAction as jest.Mock).mockResolvedValue(true);
    await visit(1);
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
  });
});
