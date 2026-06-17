import { render } from "@testing-library/react-native";
import MosqueSheet from "@/components/mosques/MosqueSheet";
import type { Mosque } from "@/services/getNearbyMosques";

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
  return ({ children, ...p }: any) => <Pressable {...p}>{children}</Pressable>;
});

const mosques: Mosque[] = [
  { id: "1", name: "Masjid Al-Noor", address: "120 Cedar St", lat: 41.89, lng: -87.63 },
  { id: "2", name: "Islamic Center", address: "88 Maple Ave", lat: 41.90, lng: -87.64 },
];

it("renders the nearby count header and a row per mosque", () => {
  const { getByText } = render(
    <MosqueSheet
      mosques={mosques}
      userLoc={{ latitude: 41.881, longitude: -87.623 }}
      selectedId={null}
      onSelect={jest.fn()}
      onDirections={jest.fn()}
      bottomInset={80}
    />,
  );
  expect(getByText("2 mosques nearby")).toBeTruthy();
  expect(getByText("Masjid Al-Noor")).toBeTruthy();
  expect(getByText("Islamic Center")).toBeTruthy();
});
