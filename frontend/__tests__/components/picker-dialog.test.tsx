// frontend/__tests__/components/picker-dialog.test.tsx
import { fireEvent, render, waitFor } from "@testing-library/react-native";

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

import PickerDialog from "@/components/settings/PickerDialog";

const items = [
  { label: "Auto", value: -1 },
  { label: "Muslim World League (MWL)", value: 4 },
];

describe("PickerDialog", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders the title and items when visible", () => {
    const { getByText } = render(
      <PickerDialog
        visible
        title="Calculation Method"
        items={items}
        selected={-1}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(getByText("Calculation Method")).toBeTruthy();
    expect(getByText("Auto")).toBeTruthy();
    expect(getByText("Muslim World League (MWL)")).toBeTruthy();
  });

  it("selecting an item fires onSelect with a haptic", () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      <PickerDialog
        visible
        title="Calculation Method"
        items={items}
        selected={-1}
        onSelect={onSelect}
        onClose={jest.fn()}
      />,
    );
    fireEvent.press(getByText("Muslim World League (MWL)"));
    expect(onSelect).toHaveBeenCalledWith(4);
    expect(mockHaptic).toHaveBeenCalledWith("selection");
  });

  it("hides the search field unless searchable", () => {
    const { queryByPlaceholderText } = render(
      <PickerDialog
        visible
        title="Calculation Method"
        items={items}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(queryByPlaceholderText("Search")).toBeNull();
  });

  it("filters items when searchable", async () => {
    const { getByPlaceholderText, queryByText } = render(
      <PickerDialog
        visible
        searchable
        title="Select city"
        items={[
          { label: "Mecca", value: "mecca" },
          { label: "Cairo", value: "cairo" },
        ]}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    fireEvent.changeText(getByPlaceholderText("Search"), "cai");
    await waitFor(() => {
      expect(queryByText("Mecca")).toBeNull();
      expect(queryByText("Cairo")).toBeTruthy();
    });
  });

  it("returns null when not visible", () => {
    const { toJSON } = render(
      <PickerDialog
        visible={false}
        title="X"
        items={items}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(toJSON()).toBeNull();
  });
});
