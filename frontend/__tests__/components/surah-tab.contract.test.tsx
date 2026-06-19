import { fireEvent, render } from "@testing-library/react-native";

import SurahTab from "@/components/quran/navigator/SurahTab";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme, isHydrated: true }) };
});

jest.mock("@gorhom/bottom-sheet", () => {
  const { FlatList, TextInput } = require("react-native");
  return { BottomSheetFlatList: FlatList, BottomSheetTextInput: TextInput };
});

jest.mock("@/components/PressableScale", () => {
  const { Pressable } = require("react-native");
  return ({ children, ...props }: any) => (
    <Pressable {...props}>{children}</Pressable>
  );
});

const surah = (surahNumber: number, englishName: string) => ({
  surahNumber,
  englishName,
  arabicName: `${englishName}-ar`,
  ayahCount: 10,
  revelationPlace: "Mecca",
  revelationType: "Meccan",
  pages: "1-1",
  juzRanges: [],
});

// An-Nisaa (4) is NOT in the Popular set and is placed first so it renders
// within the list's initialNumToRender once "All Sūrahs" is expanded.
const SURAHS = [
  surah(4, "An-Nisaa"),
  surah(1, "Al-Fatiha"),
  surah(2, "Al-Baqara"),
  surah(18, "Al-Kahf"),
  surah(36, "Ya-Sin"),
  surah(55, "Ar-Rahman"),
  surah(56, "Al-Waqia"),
  surah(67, "Al-Mulk"),
  surah(112, "Al-Ikhlas"),
];

function buildProps(overrides: any = {}) {
  return {
    surahs: SURAHS,
    filteredSurahs: SURAHS,
    ayahSearchResults: [],
    juzSearchResult: null,
    surahSearchQuery: "",
    lastRead: {
      surahNumber: 54,
      ayahNumber: 47,
      englishName: "Al-Qamar",
      arabicName: "القمر",
    },
    onSurahSearchQueryChange: jest.fn(),
    onSelectSurah: jest.fn(),
    onSelectAyah: jest.fn(),
    onSelectJuz: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };
}

describe("SurahTab contract", () => {
  it("default view shows Continue reading + Popular and hides the full list", () => {
    const { getByText, queryByText } = render(
      <SurahTab {...(buildProps() as any)} />,
    );

    expect(getByText("Continue reading")).toBeTruthy();
    expect(getByText("Al-Qamar")).toBeTruthy();
    expect(getByText("Popular")).toBeTruthy();
    expect(getByText("All Sūrahs")).toBeTruthy();

    // Popular tiles render in the header...
    expect(getByText("Al-Kahf")).toBeTruthy();
    expect(getByText("Al-Mulk")).toBeTruthy();
    // ...but non-popular surahs do not, until expanded.
    expect(queryByText("An-Nisaa")).toBeNull();
  });

  it('reveals the full list when "All Sūrahs" is tapped', () => {
    const { getByText, queryByText } = render(
      <SurahTab {...(buildProps() as any)} />,
    );

    expect(queryByText("An-Nisaa")).toBeNull();
    fireEvent.press(getByText("All Sūrahs"));
    expect(getByText("An-Nisaa")).toBeTruthy();
  });

  it("search mode hides Continue/Popular and shows filtered results", () => {
    const { getByText, queryByText } = render(
      <SurahTab
        {...(buildProps({
          surahSearchQuery: "kahf",
          filteredSurahs: [surah(18, "Al-Kahf")],
        }) as any)}
      />,
    );

    expect(queryByText("Popular")).toBeNull();
    expect(queryByText("Continue reading")).toBeNull();
    expect(getByText("Al-Kahf")).toBeTruthy();
  });

  it("wires Popular and Continue taps through onClose", () => {
    const props = buildProps();
    const { getByText } = render(<SurahTab {...(props as any)} />);

    fireEvent.press(getByText("Al-Kahf"));
    fireEvent.press(getByText("Al-Qamar"));
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });
});
