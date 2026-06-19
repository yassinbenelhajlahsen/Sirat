import { render } from "@testing-library/react-native";

jest.mock("@/context/ThemeContext", () => {
  const { defaultTheme } = jest.requireActual("@/constants/theme");
  return { useTheme: () => ({ theme: defaultTheme, isHydrated: true }) };
});

import SurahBanner from "@/components/quran/SurahBanner";

describe("SurahBanner", () => {
  it("renders the arabic and english surah names", () => {
    const { getByText } = render(
      <SurahBanner arabicName="البقرة" englishName="Al-Baqarah" />,
    );
    expect(getByText("البقرة")).toBeTruthy();
    expect(getByText("Al-Baqarah")).toBeTruthy();
  });

  it("omits english line when not provided", () => {
    const { queryByText } = render(<SurahBanner arabicName="البقرة" />);
    expect(queryByText("Al-Baqarah")).toBeNull();
  });
});
