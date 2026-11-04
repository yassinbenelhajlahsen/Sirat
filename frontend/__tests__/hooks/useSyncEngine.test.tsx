import { render, act } from "@testing-library/react-native";
import { DeviceEventEmitter } from "react-native";

const mockSyncNow = jest.fn();
const mockIsApplying = jest.fn(() => false);
const mockAuthState = { isLoaded: true, isSignedIn: false, userId: null as string | null, email: null as string | null, firstName: null as string | null };

jest.mock("@/services/sync/syncEngine", () => ({
  syncNow: (...a: unknown[]) => mockSyncNow(...a),
  isApplyingRemote: () => mockIsApplying(),
}));
jest.mock("@/hooks/useAuthState", () => ({ useAuthState: () => mockAuthState }));

import { useSyncEngine } from "@/hooks/useSyncEngine";
import { notifFridaySetting } from "@/services/syncedSettings";
import { PRAYER_LOG_UPDATED_EVENT } from "@/services/tracking/prayerLog";

function Host() { useSyncEngine(); return null; }

beforeEach(() => {
  jest.useFakeTimers();
  mockSyncNow.mockReset();
  mockIsApplying.mockReturnValue(false);
  mockAuthState.isLoaded = true;
  mockAuthState.isSignedIn = false;
  mockAuthState.userId = null;
  mockAuthState.email = null;
  mockAuthState.firstName = null;
});
afterEach(() => { jest.useRealTimers(); });

it("syncs on sign-in transition", () => {
  const { rerender } = render(<Host />);
  expect(mockSyncNow).not.toHaveBeenCalled();
  mockAuthState.isSignedIn = true;
  mockAuthState.userId = "u1";
  rerender(<Host />);
  expect(mockSyncNow).toHaveBeenCalledWith("signin");
});

it("debounces change events into one sync after 4s", () => {
  mockAuthState.isSignedIn = true;
  mockAuthState.userId = "u1";
  render(<Host />);
  mockSyncNow.mockClear();
  act(() => { DeviceEventEmitter.emit(PRAYER_LOG_UPDATED_EVENT, { dateKey: "x" }); });
  act(() => { DeviceEventEmitter.emit(PRAYER_LOG_UPDATED_EVENT, { dateKey: "y" }); });
  expect(mockSyncNow).not.toHaveBeenCalled();
  act(() => { jest.advanceTimersByTime(4000); });
  expect(mockSyncNow).toHaveBeenCalledTimes(1);
});

it("ignores change events while applying remote (no feedback loop)", () => {
  mockAuthState.isSignedIn = true;
  mockAuthState.userId = "u1";
  mockIsApplying.mockReturnValue(true);
  render(<Host />);
  mockSyncNow.mockClear();
  act(() => { DeviceEventEmitter.emit(PRAYER_LOG_UPDATED_EVENT, { dateKey: "x" }); });
  act(() => { jest.advanceTimersByTime(4000); });
  expect(mockSyncNow).not.toHaveBeenCalled();
});

it("syncs after a local settings edit but not after a setting applied from another device", async () => {
  mockAuthState.isSignedIn = true;
  mockAuthState.userId = "u1";
  render(<Host />);
  mockSyncNow.mockClear();

  await act(async () => { await notifFridaySetting.applyRemote(false); });
  act(() => { jest.advanceTimersByTime(4000); });
  expect(mockSyncNow).not.toHaveBeenCalled();

  await act(async () => { await notifFridaySetting.set(true); });
  act(() => { jest.advanceTimersByTime(4000); });
  expect(mockSyncNow).toHaveBeenCalledTimes(1);
});
