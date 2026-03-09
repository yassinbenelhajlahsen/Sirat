import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Network from "expo-network";

import { clearDuaHistory, getDuaHistory, requestDua, saveDuaToHistory, type Dua } from "@/services/duaService";

jest.mock("@/services/apiClient", () => ({
  apiPost: jest.fn(),
  AppUpdateRequiredError: class AppUpdateRequiredError extends Error {
    minVersion: string;
    currentVersion: string;
    constructor(minVersion: string, currentVersion: string) {
      super("APP_UPDATE_REQUIRED");
      this.name = "AppUpdateRequiredError";
      this.minVersion = minVersion;
      this.currentVersion = currentVersion;
    }
  },
}));

import { apiPost } from "@/services/apiClient";

const mockApiPost = apiPost as jest.MockedFunction<typeof apiPost>;
const mockGetNetworkStateAsync = Network.getNetworkStateAsync as jest.MockedFunction<
  typeof Network.getNetworkStateAsync
>;

const GENERAL_DUA_ID = 100;

describe("services/duaService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("uses local regex precedence and does not call backend", async () => {
    mockGetNetworkStateAsync.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: "WIFI",
    } as Network.NetworkState);

    const request = requestDua("I am studying for my exam and need help");

    await jest.advanceTimersByTimeAsync(1200);

    const dua = await request;

    expect(dua.category).toBe("exam");
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it("returns general fallback when offline and no regex match", async () => {
    mockGetNetworkStateAsync.mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
      type: "NONE",
    } as Network.NetworkState);

    const request = requestDua("totally unmatched request phrase");

    await jest.advanceTimersByTimeAsync(1200);

    const dua = await request;

    expect(dua.id).toBe(GENERAL_DUA_ID);
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it("maps backend errors to their message", async () => {
    mockGetNetworkStateAsync.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: "WIFI",
    } as Network.NetworkState);

    mockApiPost.mockRejectedValue(new Error("Request too short"));

    await expect(requestDua("not matched by regex")).rejects.toThrow("Request too short");
  });

  it("falls back to general dua on network errors", async () => {
    mockGetNetworkStateAsync.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: "WIFI",
    } as Network.NetworkState);

    mockApiPost.mockRejectedValue(
      Object.assign(new TypeError("Network request failed"), {}),
    );

    const request = requestDua("not matched by regex");

    await jest.advanceTimersByTimeAsync(1200);

    const dua = await request;

    expect(dua.id).toBe(GENERAL_DUA_ID);
  });

  it("applies simulated delay for fast local matches", async () => {
    mockGetNetworkStateAsync.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: "WIFI",
    } as Network.NetworkState);

    let settled = false;
    const promise = requestDua("exam tomorrow")
      .then(() => {
        settled = true;
      });

    await Promise.resolve();
    expect(settled).toBe(false);

    await jest.advanceTimersByTimeAsync(1199);
    expect(settled).toBe(false);

    await jest.advanceTimersByTimeAsync(1);
    await promise;
    expect(settled).toBe(true);
  });

  it("caps history to 10 items and persists latest-first order", async () => {
    await clearDuaHistory();

    for (let i = 1; i <= 11; i += 1) {
      const dua: Dua = {
        id: i,
        category: `c-${i}`,
        arabic: `a-${i}`,
        english: `e-${i}`,
        transliteration: `t-${i}`,
        reference: `r-${i}`,
        source: "test",
      };
      await saveDuaToHistory(dua);
    }

    const raw = await AsyncStorage.getItem("dua_history_v1");
    const parsed = raw ? (JSON.parse(raw) as Dua[]) : [];

    expect(parsed).toHaveLength(10);
    expect(parsed[0].id).toBe(11);
    expect(parsed[9].id).toBe(2);

    const history = await getDuaHistory();
    expect(history).toHaveLength(10);
    expect(history[0].id).toBe(11);
  });
});
