import AsyncStorage from "@react-native-async-storage/async-storage";

const mockGetToken = jest.fn();
const mockApiPost = jest.fn();
const mockNetwork = jest.fn();

jest.mock("@/services/auth/authToken", () => ({ getAuthToken: () => mockGetToken() }));
jest.mock("@/services/apiClient", () => ({ apiPost: (...a: unknown[]) => mockApiPost(...a) }));
jest.mock("expo-network", () => ({ getNetworkStateAsync: () => mockNetwork() }));

import { syncNow, LAST_SYNCED_KEY } from "@/services/sync/syncEngine";

beforeEach(async () => {
  await AsyncStorage.clear();
  mockGetToken.mockReset();
  mockApiPost.mockReset();
  mockNetwork.mockReset();
  mockNetwork.mockResolvedValue({ isConnected: true });
});

it("does nothing when signed out", async () => {
  mockGetToken.mockResolvedValue(null);
  await syncNow();
  expect(mockApiPost).not.toHaveBeenCalled();
});

it("does nothing when offline", async () => {
  mockGetToken.mockResolvedValue("jwt");
  mockNetwork.mockResolvedValue({ isConnected: false });
  await syncNow();
  expect(mockApiPost).not.toHaveBeenCalled();
});

it("posts payload and records last-synced on success", async () => {
  mockGetToken.mockResolvedValue("jwt");
  mockApiPost.mockResolvedValue({
    prayer_log: {}, habits: [], habit_log: {}, settings: {},
    syncedAt: "2026-06-20T00:00:00.000Z",
  });
  await syncNow();
  expect(mockApiPost).toHaveBeenCalledWith("/api/sync", expect.objectContaining({
    prayer_log: expect.any(Object), habits: expect.any(Array),
    habit_log: expect.any(Object), settings: expect.any(Object),
  }));
  expect(await AsyncStorage.getItem(LAST_SYNCED_KEY)).toBe(String(Date.parse("2026-06-20T00:00:00.000Z")));
});

it("coalesces concurrent calls into a single in-flight sync plus one rerun", async () => {
  mockGetToken.mockResolvedValue("jwt");
  let resolve!: (v: unknown) => void;
  mockApiPost.mockImplementation(() => new Promise((r) => { resolve = r; }));
  const a = syncNow();
  const b = syncNow(); // should not start a second POST yet
  expect(mockApiPost).toHaveBeenCalledTimes(1);
  resolve({ prayer_log: {}, habits: [], habit_log: {}, settings: {}, syncedAt: "2026-06-20T00:00:00.000Z" });
  await a; await b;
  // one rerun fired because b arrived mid-flight
  expect(mockApiPost).toHaveBeenCalledTimes(2);
});
