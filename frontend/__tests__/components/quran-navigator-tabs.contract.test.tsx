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
  it("renders both tab options and reflects selected state", () => {
    const { getAllByRole } = render(
      <NavigatorTabs selectedTab="goto" onSelectTab={jest.fn()} />
    );

    const tabButtons = getAllByRole("button");
    const goToTab = tabButtons.find((button) =>
      within(button).queryByText("Go To")
    );
    const bookmarksTab = tabButtons.find((button) =>
      within(button).queryByText("Bookmarks")
    );

    expect(goToTab).toBeTruthy();
    expect(bookmarksTab).toBeTruthy();
    expect(goToTab.props.accessibilityState).toEqual({ selected: true });
    expect(bookmarksTab.props.accessibilityState).toEqual({ selected: false });
  });

  it("wires tab press callbacks with the expected tab keys", () => {
    const onSelectTab = jest.fn();
    const { getByText } = render(
      <NavigatorTabs selectedTab="goto" onSelectTab={onSelectTab} />
    );

    fireEvent.press(getByText("Bookmarks"));
    fireEvent.press(getByText("Go To"));

    expect(onSelectTab).toHaveBeenNthCalledWith(1, "bookmarks");
    expect(onSelectTab).toHaveBeenNthCalledWith(2, "goto");
  });
});
