import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as Network from "expo-network";

import { clearDuaHistory, getDuaHistory, requestDua, saveDuaToHistory, type Dua } from "@/services/duaService";

jest.mock("axios");

const mockAxiosPost = axios.post as jest.MockedFunction<typeof axios.post>;
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
    expect(mockAxiosPost).not.toHaveBeenCalled();
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
    expect(mockAxiosPost).not.toHaveBeenCalled();
  });

  it("maps 400 backend errors to backend message", async () => {
    mockGetNetworkStateAsync.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: "WIFI",
    } as Network.NetworkState);

    mockAxiosPost.mockRejectedValue({
      response: {
        status: 400,
        data: { error: "Request too short" },
      },
      message: "Bad Request",
    });

    await expect(requestDua("not matched by regex")).rejects.toThrow("Request too short");
  });

  it("maps 500 backend errors to generic backend failure message", async () => {
    mockGetNetworkStateAsync.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: "WIFI",
    } as Network.NetworkState);

    mockAxiosPost.mockRejectedValue({
      response: {
        status: 500,
        data: {},
      },
      message: "Server Error",
    });

    await expect(requestDua("not matched by regex")).rejects.toThrow(
      "Backend error. Please try again.",
    );
  });

  it("falls back to general dua on network errors", async () => {
    mockGetNetworkStateAsync.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: "WIFI",
    } as Network.NetworkState);

    mockAxiosPost.mockRejectedValue({
      code: "ERR_NETWORK",
      message: "Network Error",
    });

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
