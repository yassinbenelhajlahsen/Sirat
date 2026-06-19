import { act, fireEvent, render } from "@testing-library/react-native";

import QuranAyahCard from "@/components/quran/QuranAyahCard";
import type { NormalizedAyah, NormalizedSurahMeta } from "@/services/quranData";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return {
    useTheme: () => ({ theme: defaultTheme, isHydrated: true }),
  };
});

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text>,
  };
});

const ayah: NormalizedAyah = {
  surahNumber: 2,
  surahNameAr: "البقرة",
  surahNameEn: "Al-Baqarah",
  juzNumber: 3,
  ayahNumber: 255,
  arabicText: "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ",
  englishText: "Allah! There is no deity except Him.",
  transliteration: "Allahu la ilaha illa huwa",
};

const surahMeta: NormalizedSurahMeta = {
  surahNumber: 2,
  arabicName: "سُورَةُ البَقَرَةِ",
  englishName: "The Cow",
  ayahCount: 286,
  revelationPlace: "Madinah",
  revelationType: "Medinan",
  pages: "2-49",
  juzRanges: [
    {
      juzNumber: 1,
      startAyah: 1,
      endAyah: 141,
    },
  ],
};

describe("QuranAyahCard contract", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders surah header, ayah content, and bookmark state", () => {
    const { getByText } = render(
      <QuranAyahCard
        ayah={ayah}
        isSurahStart
        surahMeta={surahMeta}
        showTransliteration
        isBookmarked
      />
    );

    expect(getByText("سُورَةُ البَقَرَةِ")).toBeTruthy();
    expect(getByText("The Cow")).toBeTruthy();
    expect(getByText(ayah.arabicText, { exact: false })).toBeTruthy();
    expect(getByText(ayah.transliteration as string)).toBeTruthy();
    expect(getByText(ayah.englishText)).toBeTruthy();
    expect(getByText("icon:bookmark")).toBeTruthy();
  });

  it("respects visibility flags for Arabic, transliteration, and English blocks", () => {
    const { queryByText } = render(
      <QuranAyahCard
        ayah={ayah}
        isSurahStart={false}
        showArabic={false}
        showTransliteration={false}
        showEnglish={false}
      />
    );

    expect(queryByText(ayah.arabicText)).toBeNull();
    expect(queryByText(ayah.transliteration as string)).toBeNull();
    expect(queryByText(ayah.englishText)).toBeNull();
  });

  it("fires onDoubleTap only when a second tap occurs within the allowed interval", () => {
    jest.useFakeTimers();
    const onDoubleTap = jest.fn();
    const { getByLabelText } = render(
      <QuranAyahCard ayah={ayah} isSurahStart={false} onDoubleTap={onDoubleTap} />
    );
    const ayahPressable = getByLabelText("Ayah 255 from Surah 2");

    fireEvent.press(ayahPressable);
    expect(onDoubleTap).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(200);
    });
    fireEvent.press(ayahPressable);

    expect(onDoubleTap).toHaveBeenCalledTimes(1);
    act(() => {
      jest.runOnlyPendingTimers();
    });
  });
});
