import { act, renderHook, waitFor } from "@testing-library/react-native";
import { DeviceEventEmitter } from "react-native";

import { useQuranTextScale } from "@/hooks/useQuranTextScale";
import {
  QURAN_TEXT_SCALE_UPDATED_EVENT,
  getCachedQuranTextScale,
  getQuranTextScale,
  saveQuranTextScale,
} from "@/services/quranTextScale";

jest.mock("@/services/quranTextScale", () => {
  const actual = jest.requireActual("@/services/quranTextScale");
  return {
    ...actual,
    getCachedQuranTextScale: jest.fn(),
    getQuranTextScale: jest.fn(),
    saveQuranTextScale: jest.fn(),
  };
});

const mockCached = getCachedQuranTextScale as jest.MockedFunction<typeof getCachedQuranTextScale>;
const mockGet = getQuranTextScale as jest.MockedFunction<typeof getQuranTextScale>;
const mockSave = saveQuranTextScale as jest.MockedFunction<typeof saveQuranTextScale>;

describe("useQuranTextScale", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCached.mockReturnValue(1);
    mockGet.mockResolvedValue(1.15);
    mockSave.mockResolvedValue(1.3);
  });

  it("starts from the cache, then applies the loaded value", async () => {
    const { result } = renderHook(() => useQuranTextScale());
    expect(result.current.textScale).toBe(1);
    await waitFor(() => {
      expect(result.current.textScale).toBe(1.15);
      expect(result.current.loaded).toBe(true);
    });
  });

  it("saves through the service and follows update events", async () => {
    const { result } = renderHook(() => useQuranTextScale());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => {
      await result.current.setTextScale(1.3);
    });
    expect(mockSave).toHaveBeenCalledWith(1.3);
    expect(result.current.textScale).toBe(1.3);

    act(() => {
      DeviceEventEmitter.emit(QURAN_TEXT_SCALE_UPDATED_EVENT, 0.9);
    });
    expect(result.current.textScale).toBe(0.9);
  });
});
