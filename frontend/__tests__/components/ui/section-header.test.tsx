import { fireEvent, render } from "@testing-library/react-native";

import SectionHeader, { SectionFooter } from "@/components/ui/SectionHeader";
import ScreenHeader from "@/components/ui/ScreenHeader";
import EmptyState from "@/components/ui/EmptyState";
import { ThemeProvider } from "@/context/ThemeContext";

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe("SectionHeader", () => {
  it("renders an uppercase header with an optional text action", () => {
    const onAction = jest.fn();
    const { getByRole } = render(
      wrap(<SectionHeader title="Habits" actionLabel="+ New" onActionPress={onAction} />),
    );
    expect(getByRole("header", { name: "HABITS" })).toBeTruthy();
    fireEvent.press(getByRole("button", { name: "+ New" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("renders footer copy", () => {
    const { getByText } = render(wrap(<SectionFooter>Fires before the prayer ends.</SectionFooter>));
    expect(getByText("Fires before the prayer ends.")).toBeTruthy();
  });
});

describe("ScreenHeader", () => {
  it("renders the large title, a supporting line and a leading control", () => {
    const onBack = jest.fn();
    const { getByRole, getByText } = render(
      wrap(
        <ScreenHeader
          title="Tracker"
          subtitle="Keep your phone flat"
          leadingIcon="chevron-back"
          onLeadingPress={onBack}
          leadingAccessibilityLabel="Back"
        />,
      ),
    );
    expect(getByRole("header", { name: "Tracker" })).toBeTruthy();
    expect(getByText("Keep your phone flat")).toBeTruthy();
    fireEvent.press(getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe("EmptyState", () => {
  it("renders the glyph, copy and both actions", () => {
    const onAction = jest.fn();
    const { getByRole, getByText } = render(
      wrap(
        <EmptyState
          icon="location-outline"
          title="Location off"
          message="Turn on location to find mosques nearby."
          actionLabel="Enable location"
          onAction={onAction}
          note="Prayer times still work without it."
        />,
      ),
    );
    expect(getByRole("header", { name: "Location off" })).toBeTruthy();
    expect(getByText("Prayer times still work without it.")).toBeTruthy();
    fireEvent.press(getByRole("button", { name: "Enable location" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
