import { fireEvent, render, within } from "@testing-library/react-native";

import NavigatorTabs from "@/components/quran/navigator/NavigatorTabs";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return {
    useTheme: () => ({ theme: defaultTheme, isHydrated: true }),
  };
});

jest.mock("@/components/PressableScale", () => {
  const { Pressable } = require("react-native");
  return ({ children, ...props }: any) => (
    <Pressable {...props}>
      {children}
    </Pressable>
  );
});

describe("NavigatorTabs contract", () => {
  it("renders all three segment options and reflects selected state", () => {
    const { getAllByRole } = render(
      <NavigatorTabs selectedTab="surah" onSelectTab={jest.fn()} />
    );

    const tabButtons = getAllByRole("button");
    const surahTab = tabButtons.find((button) =>
      within(button).queryByText("Sūrah")
    );
    const juzTab = tabButtons.find((button) =>
      within(button).queryByText("Juzʾ")
    );
    const bookmarksTab = tabButtons.find((button) =>
      within(button).queryByText("Bookmarks")
    );

    expect(surahTab).toBeTruthy();
    expect(juzTab).toBeTruthy();
    expect(bookmarksTab).toBeTruthy();
    expect(surahTab.props.accessibilityState).toEqual({ selected: true });
    expect(juzTab.props.accessibilityState).toEqual({ selected: false });
    expect(bookmarksTab.props.accessibilityState).toEqual({ selected: false });
  });

  it("wires tab press callbacks with the expected tab keys", () => {
    const onSelectTab = jest.fn();
    const { getByText } = render(
      <NavigatorTabs selectedTab="surah" onSelectTab={onSelectTab} />
    );

    fireEvent.press(getByText("Sūrah"));
    fireEvent.press(getByText("Juzʾ"));
    fireEvent.press(getByText("Bookmarks"));

    expect(onSelectTab).toHaveBeenNthCalledWith(1, "surah");
    expect(onSelectTab).toHaveBeenNthCalledWith(2, "juz");
    expect(onSelectTab).toHaveBeenNthCalledWith(3, "bookmarks");
  });
});
