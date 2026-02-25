import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

jest.mock("@/hooks/useQuranAudio", () => ({
  useQuranAudio: jest.fn(),
}));

jest.mock("@/services/quranData", () => ({
  getSurahMeta: jest.fn(),
}));

import {
  QuranAudioProvider,
  type QuranSurahMeta,
  useQuranAudioController,
} from "@/context/QuranAudioProvider";
import {
  useQuranAudio,
  type UseQuranAudioResult,
} from "@/hooks/useQuranAudio";
import { getSurahMeta, type NormalizedSurahMeta } from "@/services/quranData";

const mockPlayCurrentSurah = jest.fn(async () => {});
const mockPauseAudio = jest.fn(async () => {});
const mockStopAudio = jest.fn(async () => {});

const mockUseQuranAudio = useQuranAudio as jest.MockedFunction<
  typeof useQuranAudio
>;
const mockGetSurahMeta = getSurahMeta as jest.MockedFunction<
  typeof getSurahMeta
>;

let capturedOnSurahComplete: ((surahNumber: number) => void) | undefined;
let observedCurrentSurahNumbers: number[] = [];
let audioOverrides: Partial<UseQuranAudioResult> = {};

const wrapper = ({ children }: PropsWithChildren) => (
  <QuranAudioProvider>{children}</QuranAudioProvider>
);

function buildSurahMeta(
  surahNumber: number,
  englishName: string,
  arabicName: string
): NormalizedSurahMeta {
  return {
    surahNumber,
    englishName,
    arabicName,
    ayahCount: 7,
    revelationPlace: "Makkah",
    revelationType: "Meccan",
    pages: "1",
    juzRanges: [
      {
        juzNumber: 1,
        startAyah: 1,
        endAyah: 7,
      },
    ],
  };
}

const SURAH_META_FIXTURE: readonly NormalizedSurahMeta[] = [
  buildSurahMeta(1, "Al-Fatihah", "الفاتحة"),
  buildSurahMeta(2, "Al-Baqarah", "البقرة"),
  buildSurahMeta(3, "Ali 'Imran", "آل عمران"),
];

describe("context/QuranAudioProvider", () => {
  beforeEach(() => {
    capturedOnSurahComplete = undefined;
    observedCurrentSurahNumbers = [];
    audioOverrides = {};

    mockPlayCurrentSurah.mockReset().mockResolvedValue(undefined);
    mockPauseAudio.mockReset().mockResolvedValue(undefined);
    mockStopAudio.mockReset().mockResolvedValue(undefined);

    mockGetSurahMeta.mockReset().mockReturnValue(SURAH_META_FIXTURE);
    mockUseQuranAudio.mockReset().mockImplementation((options) => {
      observedCurrentSurahNumbers.push(options.currentSurahNumber);
      capturedOnSurahComplete = options.onSurahComplete;

      return {
        isOnline: true,
        isPlaying: false,
        isAudioLoading: false,
        audioIconName: "play",
        audioAccessibilityLabel: "Play surah audio",
        audioPlayer: null,
        playbackDuration: 0,
        playbackPosition: 0,
        playCurrentSurah: mockPlayCurrentSurah,
        pauseAudio: mockPauseAudio,
        stopAudio: mockStopAudio,
        offlinePillVisible: false,
        ...audioOverrides,
      };
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("throws when controller hook is used outside provider", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useQuranAudioController())).toThrow(
      "useQuranAudioController must be used within a QuranAudioProvider"
    );

    errorSpy.mockRestore();
  });

  it("runs playSurah flow by updating current meta and triggering playCurrentSurah", async () => {
    let resolvePlay: (() => void) | null = null;
    mockPlayCurrentSurah.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolvePlay = resolve;
        })
    );

    const { result } = renderHook(() => useQuranAudioController(), { wrapper });

    const targetSurah: QuranSurahMeta = {
      surahNumber: 2,
      englishName: "Al-Baqarah",
      arabicName: "البقرة",
    };

    act(() => {
      result.current.playSurah(targetSurah);
    });

    expect(result.current.currentSurahMeta).toEqual(targetSurah);
    expect(result.current.miniPlayerVisible).toBe(true);

    await waitFor(() => {
      expect(mockPlayCurrentSurah).toHaveBeenCalledTimes(1);
    });

    expect(observedCurrentSurahNumbers).toContain(2);

    await act(async () => {
      resolvePlay?.();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.miniPlayerVisible).toBe(false);
    });
  });

  it("resets playback session state even when stopAudio throws", async () => {
    mockStopAudio.mockRejectedValueOnce(new Error("stop failed"));

    const { result } = renderHook(() => useQuranAudioController(), { wrapper });

    act(() => {
      result.current.playSurah({
        surahNumber: 3,
        englishName: "Ali 'Imran",
        arabicName: "آل عمران",
      });
    });

    await waitFor(() => {
      expect(mockPlayCurrentSurah).toHaveBeenCalledTimes(1);
      expect(result.current.currentSurahMeta?.surahNumber).toBe(3);
    });

    act(() => {
      result.current.requestCurrentSurahFocus();
    });
    expect(result.current.pendingSurahFocusNumber).toBe(3);

    await act(async () => {
      await result.current.stopPlaybackSession();
    });

    expect(mockStopAudio).toHaveBeenCalledTimes(1);
    expect(result.current.currentSurahMeta).toBeNull();
    expect(result.current.pendingSurahFocusNumber).toBeNull();
    expect(result.current.miniPlayerVisible).toBe(false);
  });

  it("supports focus helpers for current surah and explicit clear", async () => {
    const { result } = renderHook(() => useQuranAudioController(), { wrapper });

    act(() => {
      result.current.requestCurrentSurahFocus();
    });
    expect(result.current.pendingSurahFocusNumber).toBeNull();

    act(() => {
      result.current.playSurah({
        surahNumber: 1,
        englishName: "Al-Fatihah",
        arabicName: "الفاتحة",
      });
    });

    await waitFor(() => {
      expect(mockPlayCurrentSurah).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.requestCurrentSurahFocus();
    });
    expect(result.current.pendingSurahFocusNumber).toBe(1);

    act(() => {
      result.current.clearPendingSurahFocus();
    });
    expect(result.current.pendingSurahFocusNumber).toBeNull();
  });

  it("queues the next surah from onSurahComplete using retried metadata load", async () => {
    jest.useFakeTimers();
    mockGetSurahMeta
      .mockImplementationOnce(() => {
        throw new Error("not ready");
      })
      .mockImplementation(() => SURAH_META_FIXTURE);

    const { result } = renderHook(() => useQuranAudioController(), { wrapper });

    expect(mockGetSurahMeta).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(200);
      await Promise.resolve();
    });

    expect(mockGetSurahMeta).toHaveBeenCalledTimes(2);

    act(() => {
      result.current.playSurah({
        surahNumber: 1,
        englishName: "Al-Fatihah",
        arabicName: "الفاتحة",
      });
    });

    await waitFor(() => {
      expect(mockPlayCurrentSurah).toHaveBeenCalledTimes(1);
    });

    expect(capturedOnSurahComplete).toBeDefined();
    act(() => {
      capturedOnSurahComplete?.(1);
    });

    await waitFor(() => {
      expect(mockPlayCurrentSurah).toHaveBeenCalledTimes(2);
      expect(result.current.currentSurahMeta).toEqual({
        surahNumber: 2,
        englishName: "Al-Baqarah",
        arabicName: "البقرة",
      });
    });

    expect(
      observedCurrentSurahNumbers[observedCurrentSurahNumbers.length - 1]
    ).toBe(2);
  });

  it("stops playback when the completed surah is the last available surah", async () => {
    mockGetSurahMeta.mockReturnValue([SURAH_META_FIXTURE[0]]);

    const { result } = renderHook(() => useQuranAudioController(), { wrapper });

    act(() => {
      result.current.playSurah({
        surahNumber: 1,
        englishName: "Al-Fatihah",
        arabicName: "الفاتحة",
      });
    });

    await waitFor(() => {
      expect(mockPlayCurrentSurah).toHaveBeenCalledTimes(1);
    });

    expect(capturedOnSurahComplete).toBeDefined();
    act(() => {
      capturedOnSurahComplete?.(1);
    });

    await waitFor(() => {
      expect(mockStopAudio).toHaveBeenCalledTimes(1);
      expect(result.current.currentSurahMeta).toBeNull();
    });

    expect(mockPlayCurrentSurah).toHaveBeenCalledTimes(1);
  });
});
