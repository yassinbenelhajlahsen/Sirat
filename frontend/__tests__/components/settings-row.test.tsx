// frontend/__tests__/components/settings-row.test.tsx
import { fireEvent, render } from "@testing-library/react-native";

const mockHaptic = jest.fn();

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme }) };
});
jest.mock("@/hooks/useHaptics", () => ({ useHaptics: () => mockHaptic }));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

import SettingsRow from "@/components/settings/SettingsRow";

describe("SettingsRow", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders title, subtitle, value and icon", () => {
    const { getByText } = render(
      <SettingsRow
        icon="compass-outline"
        title="Calculation Method"
        subtitle="How timings are computed"
        value="Auto"
      />,
    );
    expect(getByText("Calculation Method")).toBeTruthy();
    expect(getByText("How timings are computed")).toBeTruthy();
    expect(getByText("Auto")).toBeTruthy();
    expect(getByText("icon:compass-outline")).toBeTruthy();
  });

  it("fires onPress and a selection haptic when pressed", () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <SettingsRow icon="star-outline" title="Rate Sirat" onPress={onPress} />,
    );
    fireEvent.press(getByLabelText("Rate Sirat"));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(mockHaptic).toHaveBeenCalledWith("selection");
  });

  it("does not fire when disabled", () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <SettingsRow
        icon="star-outline"
        title="Rate Sirat"
        onPress={onPress}
        disabled
      />,
    );
    fireEvent.press(getByLabelText("Rate Sirat"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
