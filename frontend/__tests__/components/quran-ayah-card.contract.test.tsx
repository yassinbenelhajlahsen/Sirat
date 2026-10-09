import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

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

  it("reveals visible Bookmark and Copy actions on tap and wires them", () => {
    const onBookmark = jest.fn();
    const onCopy = jest.fn();
    const { getByLabelText, queryByLabelText } = render(
      <QuranAyahCard
        ayah={ayah}
        isSurahStart={false}
        onBookmark={onBookmark}
        onCopy={onCopy}
      />
    );
    const ayahPressable = getByLabelText("Ayah 255 from Surah 2");
    expect(queryByLabelText("Bookmark this ayah")).toBeNull();
    expect(ayahPressable.props.accessibilityState).toEqual({ expanded: false });

    fireEvent.press(ayahPressable);
    expect(getByLabelText("Ayah 255 from Surah 2").props.accessibilityState).toEqual({
      expanded: true,
    });

    fireEvent.press(getByLabelText("Bookmark this ayah"));
    expect(onBookmark).toHaveBeenCalledTimes(1);
    // Acting on a row closes it again.
    expect(queryByLabelText("Copy this ayah")).toBeNull();

    fireEvent.press(getByLabelText("Ayah 255 from Surah 2"));
    fireEvent.press(getByLabelText("Copy this ayah"));
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  describe("when the parent controls which card is open", () => {
    it("asks to open instead of opening itself, so only one card can be open", () => {
      const onActionsOpenChange = jest.fn();
      const { getByLabelText, queryByLabelText } = render(
        <QuranAyahCard
          ayah={ayah}
          isSurahStart={false}
          onBookmark={jest.fn()}
          actionsOpen={false}
          onActionsOpenChange={onActionsOpenChange}
        />
      );

      fireEvent.press(getByLabelText("Ayah 255 from Surah 2"));

      expect(onActionsOpenChange).toHaveBeenCalledWith(true);
      expect(queryByLabelText("Bookmark this ayah")).toBeNull();
    });

    it("shows its actions only while the parent says it is open", () => {
      const onActionsOpenChange = jest.fn();
      const { getByLabelText, rerender, queryByLabelText } = render(
        <QuranAyahCard
          ayah={ayah}
          isSurahStart={false}
          onBookmark={jest.fn()}
          actionsOpen
          onActionsOpenChange={onActionsOpenChange}
        />
      );
      expect(getByLabelText("Bookmark this ayah")).toBeTruthy();

      fireEvent.press(getByLabelText("Ayah 255 from Surah 2"));
      expect(onActionsOpenChange).toHaveBeenCalledWith(false);

      rerender(
        <QuranAyahCard
          ayah={ayah}
          isSurahStart={false}
          onBookmark={jest.fn()}
          actionsOpen={false}
          onActionsOpenChange={onActionsOpenChange}
        />
      );
      expect(queryByLabelText("Bookmark this ayah")).toBeNull();
    });

    it("asks to close once an action is used", () => {
      const onActionsOpenChange = jest.fn();
      const onBookmark = jest.fn();
      const { getByLabelText } = render(
        <QuranAyahCard
          ayah={ayah}
          isSurahStart={false}
          onBookmark={onBookmark}
          actionsOpen
          onActionsOpenChange={onActionsOpenChange}
        />
      );

      fireEvent.press(getByLabelText("Bookmark this ayah"));

      expect(onBookmark).toHaveBeenCalledTimes(1);
      expect(onActionsOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("labels the bookmark action differently once bookmarked", () => {
    const { getByLabelText } = render(
      <QuranAyahCard ayah={ayah} isSurahStart={false} isBookmarked onBookmark={jest.fn()} />
    );
    fireEvent.press(getByLabelText("Ayah 255 from Surah 2"));
    expect(getByLabelText("View bookmark")).toBeTruthy();
  });

  it("keeps long press as the copy shortcut", () => {
    const onLongPress = jest.fn();
    const { getByLabelText } = render(
      <QuranAyahCard ayah={ayah} isSurahStart={false} onLongPress={onLongPress} />
    );
    fireEvent(getByLabelText("Ayah 255 from Surah 2"), "longPress");
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("scales every text block from the reader text size", () => {
    const { getByText } = render(
      <QuranAyahCard ayah={ayah} isSurahStart={false} showTransliteration textScale={1.3} />
    );
    expect(StyleSheet.flatten(getByText(ayah.arabicText).props.style).fontSize).toBeCloseTo(31 * 1.3);
    expect(StyleSheet.flatten(getByText(ayah.englishText).props.style).fontSize).toBeCloseTo(15 * 1.3);
    expect(
      StyleSheet.flatten(getByText(ayah.transliteration as string).props.style).fontSize,
    ).toBeCloseTo(14 * 1.3);
  });
});
