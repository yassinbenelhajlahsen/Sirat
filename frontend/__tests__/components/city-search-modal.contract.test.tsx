import { act, fireEvent, render } from "@testing-library/react-native";

import CitySearchModal from "@/components/CitySearchModal";

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

const cityItems = [
  { label: "Makkah", value: "makkah" },
  { label: "Madinah", value: "madinah" },
  { label: "Jeddah", value: "jeddah" },
];

describe("CitySearchModal contract", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns null when not visible", () => {
    const { queryByText } = render(
      <CitySearchModal
        visible={false}
        onClose={jest.fn()}
        onSelectKey={jest.fn()}
        items={cityItems}
      />
    );

    expect(queryByText("Select city")).toBeNull();
  });

  it("renders the modal contract and wires close/select callbacks", () => {
    const onClose = jest.fn();
    const onSelectKey = jest.fn();
    const { getByLabelText, getByText } = render(
      <CitySearchModal
        visible
        onClose={onClose}
        onSelectKey={onSelectKey}
        items={cityItems}
      />
    );

    expect(getByText("Select city")).toBeTruthy();
    expect(getByText("Search from the supported cities list")).toBeTruthy();

    fireEvent.press(getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.press(getByText("Madinah"));
    expect(onSelectKey).toHaveBeenCalledWith("madinah");
  });

  it("filters list results from debounced query and shows empty state when no matches", () => {
    jest.useFakeTimers();
    const { getByPlaceholderText, getByText, queryByText } = render(
      <CitySearchModal
        visible
        onClose={jest.fn()}
        onSelectKey={jest.fn()}
        items={cityItems}
      />
    );

    fireEvent.changeText(getByPlaceholderText("Search city"), "mad");
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(getByText("Madinah")).toBeTruthy();
    expect(queryByText("Makkah")).toBeNull();

    fireEvent.changeText(getByPlaceholderText("Search city"), "does-not-exist");
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(getByText("No results found")).toBeTruthy();
    expect(getByText("Try a different spelling or nearby city name.")).toBeTruthy();
  });

  it("clears query via clear button and restores full list", () => {
    jest.useFakeTimers();
    const { getByPlaceholderText, getByText } = render(
      <CitySearchModal
        visible
        onClose={jest.fn()}
        onSelectKey={jest.fn()}
        items={cityItems}
      />
    );

    fireEvent.changeText(getByPlaceholderText("Search city"), "mad");
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(getByText("Madinah")).toBeTruthy();

    fireEvent.press(getByText("icon:close-circle"));
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(getByText("Makkah")).toBeTruthy();
    expect(getByText("Jeddah")).toBeTruthy();
  });

  it("applies initialQuery before user edits", () => {
    jest.useFakeTimers();
    const { queryByText, getByText } = render(
      <CitySearchModal
        visible
        onClose={jest.fn()}
        onSelectKey={jest.fn()}
        items={cityItems}
        initialQuery="mak"
      />
    );

    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(getByText("Makkah")).toBeTruthy();
    expect(queryByText("Madinah")).toBeNull();
  });
});
