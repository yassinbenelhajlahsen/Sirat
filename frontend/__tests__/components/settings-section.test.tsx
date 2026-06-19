// frontend/__tests__/components/settings-section.test.tsx
import { render } from "@testing-library/react-native";
import { Text } from "react-native";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme }) };
});

import SettingsSection from "@/components/settings/SettingsSection";

describe("SettingsSection", () => {
  it("renders an uppercased label and its children", () => {
    const { getByText } = render(
      <SettingsSection label="Appearance">
        <Text>child-content</Text>
      </SettingsSection>,
    );
    expect(getByText("APPEARANCE")).toBeTruthy();
    expect(getByText("child-content")).toBeTruthy();
  });
});
