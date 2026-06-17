import { fireEvent, render } from "@testing-library/react-native";
import MosqueRow from "@/components/mosques/MosqueRow";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme, isHydrated: true }) };
});
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text>,
    FontAwesome5: ({ name }: { name: string }) => <Text>{`fa:${name}`}</Text>,
  };
});
jest.mock("@/components/PressableScale", () => {
  const { Pressable } = require("react-native");
  function PressableScale({ children, ...p }: any) {
    return <Pressable {...p}>{children}</Pressable>;
  }
  return PressableScale;
});

const base = {
  name: "Masjid Al-Noor",
  address: "120 Cedar St",
  distanceLabel: "0.3 mi",
  direction: "NE",
};

it("renders name, address, and distance · direction", () => {
  const { getByText } = render(
    <MosqueRow {...base} onPress={jest.fn()} onDirections={jest.fn()} />,
  );
  expect(getByText("Masjid Al-Noor")).toBeTruthy();
  expect(getByText("120 Cedar St")).toBeTruthy();
  expect(getByText("0.3 mi · NE")).toBeTruthy();
});

it("wires row select and directions independently", () => {
  const onPress = jest.fn();
  const onDirections = jest.fn();
  const { getByLabelText } = render(
    <MosqueRow {...base} onPress={onPress} onDirections={onDirections} />,
  );
  fireEvent.press(getByLabelText("Directions to Masjid Al-Noor"));
  expect(onDirections).toHaveBeenCalledTimes(1);
  expect(onPress).not.toHaveBeenCalled();
  fireEvent.press(getByLabelText("Select Masjid Al-Noor"));
  expect(onPress).toHaveBeenCalledTimes(1);
});
