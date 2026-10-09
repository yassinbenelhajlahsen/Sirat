import { fireEvent, render } from "@testing-library/react-native";

import QuranCopySheet from "@/components/quran/QuranCopySheet";
import type { NormalizedAyah } from "@/services/quranData";

jest.mock("@gorhom/bottom-sheet", () => {
  const { View } = require("react-native");
  const BottomSheet = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
  return { __esModule: true, default: BottomSheet, BottomSheetView: View };
});

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme, isHydrated: true }) };
});

jest.mock("@/hooks/useTabBarClearance", () => ({ useTabBarClearance: () => 0 }));

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

const ayah: NormalizedAyah = {
  surahNumber: 94,
  surahNameAr: "الشرح",
  surahNameEn: "Ash-Sharh",
  juzNumber: 30,
  ayahNumber: 5,
  arabicText: "فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا",
  englishText: "Indeed, with hardship comes ease.",
};

const renderSheet = (onAddWidget = jest.fn()) =>
  render(
    <QuranCopySheet
      visible
      ayah={ayah}
      showArabic
      showEnglish
      showTransliteration={false}
      onCopy={jest.fn()}
      onAddWidget={onAddWidget}
      onClose={jest.fn()}
    />,
  );

describe("QuranCopySheet widget action", () => {
  it("offers Add as widget and reports the press", () => {
    const onAddWidget = jest.fn();
    const { getByText } = renderSheet(onAddWidget);

    fireEvent.press(getByText("Add as widget"));

    expect(onAddWidget).toHaveBeenCalledTimes(1);
  });
});
