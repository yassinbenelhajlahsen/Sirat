import { act, fireEvent, render } from "@testing-library/react-native";

import AnswerText from "@/components/chat/AnswerText";
import SourcesBlock from "@/components/chat/SourcesBlock";
import type { Citation } from "@/services/chat/chatApi";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme, isHydrated: true }) };
});
jest.mock("@/services/quranData", () => ({
  getSurahMeta: () => [{ surahNumber: 2, englishName: "Al-Baqarah" }],
}));
jest.mock("expo-router", () => ({ router: { back: jest.fn(), push: jest.fn() } }));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

const { router } = jest.requireMock("expo-router");

const quran: Citation = {
  kind: "quran",
  surah: 2,
  ayah: 286,
  arabic: "لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا",
  english: "Allah does not burden a soul beyond that it can bear.",
};
const GRADE = "Hasan/Sound by virtue of corroborating evidence";
const hadith: Citation = {
  kind: "hadith",
  id: 7,
  title: "The traveller's remembrance",
  text: "When the Messenger of Allah mounted his camel he would say Allahu akbar three times.",
  arabic: null,
  grade: GRADE,
  source: "Muslim 1342",
  credit: "HadeethEnc",
};
const dua: Citation = {
  kind: "dua",
  id: 3,
  arabic: "سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا",
  transliteration: "Subhanalladhi sakhkhara lana hadha",
  english: "Glory be to the One who has placed this at our service.",
  reference: "Muslim 1342",
};

const lines = (n: number) => ({ nativeEvent: { lines: Array.from({ length: n }, () => ({})) } });

describe("chat answer text and sources", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it("AnswerText renders bold, bullets and a 'Source 1' button, and drops [3] when there are 2 sources", () => {
    const onRefPress = jest.fn();
    const { getByLabelText, getByText, queryByText, queryByLabelText } = render(
      <AnswerText
        text={"This is **important**[1] and more[3].\n\n- First point[2]\n- Second point"}
        sourceCount={2}
        onRefPress={onRefPress}
      />,
    );
    expect(getByText("important")).toBeTruthy();
    expect(getByText("Second point")).toBeTruthy();
    expect(queryByText(/\[3\]/)).toBeNull();
    expect(queryByLabelText("Source 3")).toBeNull();
    fireEvent.press(getByLabelText("Source 1"));
    expect(onRefPress).toHaveBeenCalledWith(1);
  });

  it("Quran row shows 'Al-Baqarah 2:286' and opens the verse", () => {
    const { getByText } = render(<SourcesBlock citations={[quran]} focus={null} />);
    fireEvent.press(getByText("Al-Baqarah 2:286"));
    expect(router.back).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(tabs)/Quran",
      params: { surah: 2, ayah: 286, at: expect.any(String) },
    });
  });

  it("Hadith row shows the full stored grade", () => {
    const { getByText } = render(<SourcesBlock citations={[hadith]} focus={null} />);
    expect(getByText(GRADE)).toBeTruthy();
    expect(getByText("Muslim 1342 · HadeethEnc")).toBeTruthy();
    expect(getByText("The traveller's remembrance")).toBeTruthy();
  });

  it("Dua row is labelled 'Dua' with its reference, and shows the Arabic, transliteration and English", () => {
    const { getByText } = render(<SourcesBlock citations={[dua]} focus={null} />);
    expect(getByText("Dua")).toBeTruthy();
    expect(getByText("Muslim 1342")).toBeTruthy();
    expect(getByText(dua.kind === "dua" ? dua.arabic : "")).toBeTruthy();
    expect(getByText("Subhanalladhi sakhkhara lana hadha")).toBeTruthy();
    expect(getByText("Glory be to the One who has placed this at our service.")).toBeTruthy();
  });

  it("A long source shows 'Show more' and expands to the full text", () => {
    const { getByText, queryByText } = render(<SourcesBlock citations={[quran]} focus={null} />);
    const english = getByText(quran.kind === "quran" ? quran.english! : "");
    expect(queryByText("Show more")).toBeNull();
    fireEvent(english, "textLayout", lines(4));
    expect(english.props.numberOfLines).toBe(2);
    fireEvent.press(getByText("Show more"));
    expect(queryByText("Show more")).toBeNull();
    const after = getByText(quran.kind === "quran" ? quran.english! : "");
    expect(after.props.numberOfLines).toBeUndefined();
    // Re-measuring after the expand must not bring the button back or hide anything.
    fireEvent(after, "textLayout", lines(2));
    expect(queryByText("Show more")).toBeNull();
  });

  it("A short source has no 'Show more'", () => {
    const { getByText, queryByText } = render(<SourcesBlock citations={[quran]} focus={null} />);
    fireEvent(getByText(quran.kind === "quran" ? quran.english! : ""), "textLayout", lines(1));
    expect(queryByText("Show more")).toBeNull();
  });

  it("A focus token expands the row", () => {
    const { getByText, queryByText, rerender } = render(<SourcesBlock citations={[quran, hadith]} focus={null} />);
    fireEvent(getByText(hadith.kind === "hadith" ? hadith.text : ""), "textLayout", lines(5));
    expect(getByText("Show more")).toBeTruthy();
    rerender(<SourcesBlock citations={[quran, hadith]} focus={{ n: 2, token: 1 }} />);
    expect(queryByText("Show more")).toBeNull();
    // The highlight ends and the same token must not restart it.
    act(() => jest.advanceTimersByTime(5000));
    expect(queryByText("Show more")).toBeNull();
  });

  it("The 'SOURCES' caption shows the number tags 1 to N in order", () => {
    const { getByText, getAllByText } = render(<SourcesBlock citations={[quran, hadith, dua]} focus={null} />);
    expect(getByText("SOURCES")).toBeTruthy();
    for (const n of ["1", "2", "3"]) expect(getAllByText(n)).toHaveLength(1);
  });
});
