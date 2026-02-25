import { fireEvent, render, within } from "@testing-library/react-native";
import { Modal } from "react-native";

import NavigatorModal, {
  QuranNavigatorModalProps,
} from "@/components/quran/navigator/NavigatorModal";
import useModalTransition from "@/hooks/useModalTransition";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return {
    useTheme: () => ({ theme: defaultTheme, isHydrated: true }),
  };
});

jest.mock("@/hooks/useModalTransition", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("@/components/PressableScale", () => {
  const { Pressable } = require("react-native");
  return ({ children, ...props }: any) => (
    <Pressable {...props}>
      {children}
    </Pressable>
  );
});

jest.mock("react-native-gesture-handler", () => {
  const { View } = require("react-native");
  return {
    GestureHandlerRootView: ({ children, ...props }: any) => (
      <View {...props}>
        {children}
      </View>
    ),
  };
});

jest.mock("@/components/quran/navigator/SurahTab", () => {
  const { Pressable, Text, TextInput, View } = require("react-native");
  return function SurahTabMock({
    surahSearchQuery,
    onSurahSearchQueryChange,
    onSelectSurah,
    onSelectAyah,
    onSelectJuz,
    onClose,
  }: any) {
    return (
      <View>
        <Text>SurahTabMock</Text>
        <TextInput
          accessibilityLabel="Surah search input"
          value={surahSearchQuery}
          onChangeText={onSurahSearchQueryChange}
        />
        <Pressable accessibilityRole="button" onPress={() => onSelectSurah(9)}>
          <Text>Mock select surah</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => onSelectAyah(2, 255)}
        >
          <Text>Mock select ayah</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => onSelectJuz(30)}>
          <Text>Mock select juz</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onClose}>
          <Text>Mock close from surah tab</Text>
        </Pressable>
      </View>
    );
  };
});

jest.mock("@/components/quran/navigator/BookmarksTab", () => {
  const { Pressable, Text, TextInput, View } = require("react-native");

  return function BookmarksTabMock({
    bookmarkSearchQuery,
    onBookmarkSearchQueryChange,
    onSelectBookmark,
    onDeleteBookmark,
    onClose,
  }: any) {
    const mockBookmark = {
      id: "bookmark-1",
      surahNumber: 2,
      ayahNumber: 255,
      ayahGlobalIndex: 42,
      title: "Ayat al-Kursi",
      createdAt: 1,
      updatedAt: 1,
    };

    return (
      <View>
        <Text>BookmarksTabMock</Text>
        <TextInput
          accessibilityLabel="Bookmark search input"
          value={bookmarkSearchQuery}
          onChangeText={onBookmarkSearchQueryChange}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => onSelectBookmark(mockBookmark)}
        >
          <Text>Mock select bookmark</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => onDeleteBookmark(mockBookmark)}
        >
          <Text>Mock delete bookmark</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onClose}>
          <Text>Mock close from bookmarks tab</Text>
        </Pressable>
      </View>
    );
  };
});

const mockUseModalTransition = useModalTransition as jest.MockedFunction<
  typeof useModalTransition
>;

function buildProps(
  overrides: Partial<QuranNavigatorModalProps> = {}
): QuranNavigatorModalProps {
  const sampleSurah = {
    surahNumber: 2,
    arabicName: "البقرة",
    englishName: "Al-Baqarah",
    ayahCount: 286,
    revelationPlace: "Madinah",
    revelationType: "Medinan",
    pages: "2-49",
    juzRanges: [{ juzNumber: 1, startAyah: 1, endAyah: 141 }],
  };

  const sampleBookmark = {
    bookmark: {
      id: "bookmark-1",
      surahNumber: 2,
      ayahNumber: 255,
      ayahGlobalIndex: 42,
      title: "Ayat al-Kursi",
      createdAt: 1,
      updatedAt: 1,
    },
    title: "Ayat al-Kursi",
    surahEnglish: "Al-Baqarah",
    surahArabic: "البقرة",
  };

  return {
    visible: true,
    initialTab: "goto",
    surahs: [sampleSurah],
    filteredSurahs: [sampleSurah],
    ayahSearchResults: [
      {
        surahNumber: 2,
        ayahNumber: 255,
        surahEnglishName: "Al-Baqarah",
        englishText: "Allah! There is no deity except Him.",
      },
    ],
    juzSearchResult: { juzNumber: 3 },
    surahSearchQuery: "",
    bookmarks: [sampleBookmark],
    filteredBookmarks: [sampleBookmark],
    bookmarkSearchQuery: "",
    onSurahSearchQueryChange: jest.fn(),
    onBookmarkSearchQueryChange: jest.fn(),
    onSelectSurah: jest.fn(),
    onSelectAyah: jest.fn(),
    onSelectJuz: jest.fn(),
    onSelectBookmark: jest.fn(),
    onDeleteBookmark: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };
}

describe("NavigatorModal contract", () => {
  beforeEach(() => {
    mockUseModalTransition.mockReturnValue({
      shouldRender: true,
      overlayAnimatedStyle: {},
      cardAnimatedStyle: {},
    } as any);
  });

  it("returns null when transition keeps the modal hidden", () => {
    mockUseModalTransition.mockReturnValue({
      shouldRender: false,
      overlayAnimatedStyle: {},
      cardAnimatedStyle: {},
    } as any);

    const { queryByText } = render(<NavigatorModal {...buildProps()} />);

    expect(queryByText("Navigation")).toBeNull();
  });

  it("renders the shell, switches tabs, and wires search/selection callbacks", () => {
    const props = buildProps();
    const { getAllByRole, getByLabelText, getByText } = render(
      <NavigatorModal {...props} />
    );

    const findTabButton = (label: string) =>
      getAllByRole("button").find((button) =>
        within(button).queryByText(label)
      );
    const goToTab = findTabButton("Go To");

    expect(getByText("Navigation")).toBeTruthy();
    expect(getByText("Jump by surah, ayah, juz, or bookmark")).toBeTruthy();
    expect(goToTab).toBeTruthy();
    expect(goToTab.props.accessibilityState).toEqual({ selected: true });

    fireEvent.changeText(getByLabelText("Surah search input"), "2:255");
    fireEvent.press(getByText("Mock select surah"));
    fireEvent.press(getByText("Mock select ayah"));
    fireEvent.press(getByText("Mock select juz"));

    const bookmarksTab = findTabButton("Bookmarks");
    expect(bookmarksTab).toBeTruthy();
    fireEvent.press(bookmarksTab);
    expect(bookmarksTab.props.accessibilityState).toEqual({ selected: true });

    fireEvent.changeText(getByLabelText("Bookmark search input"), "kursi");
    fireEvent.press(getByText("Mock select bookmark"));
    fireEvent.press(getByText("Mock delete bookmark"));

    expect(props.onSurahSearchQueryChange).toHaveBeenCalledWith("2:255");
    expect(props.onSelectSurah).toHaveBeenCalledWith(9);
    expect(props.onSelectAyah).toHaveBeenCalledWith(2, 255);
    expect(props.onSelectJuz).toHaveBeenCalledWith(30);
    expect(props.onBookmarkSearchQueryChange).toHaveBeenCalledWith("kursi");
    expect(props.onSelectBookmark).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "bookmark-1",
        surahNumber: 2,
        ayahNumber: 255,
      })
    );
    expect(props.onDeleteBookmark).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "bookmark-1",
      })
    );
  });

  it("wires onClose to modal request-close and child tab close actions", () => {
    const props = buildProps();
    const { UNSAFE_getByType, getByText } = render(
      <NavigatorModal {...props} />
    );

    fireEvent(UNSAFE_getByType(Modal), "onRequestClose");
    fireEvent.press(getByText("Mock close from surah tab"));
    fireEvent.press(getByText("Bookmarks"));
    fireEvent.press(getByText("Mock close from bookmarks tab"));

    expect(props.onClose).toHaveBeenCalledTimes(3);
  });
});
