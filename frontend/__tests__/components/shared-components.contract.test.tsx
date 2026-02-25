import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Share } from "react-native";

import CitySearchModal from "@/components/CitySearchModal";
import DuaCard from "@/components/DuaCard";
import DuaResultCard from "@/components/DuaResultCard";
import PrayerTimesList from "@/components/PrayerTimesList";
import type { Dua } from "@/services/duaService";
import type { PrayerTime } from "@/services/prayerTimes";

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
    MaterialCommunityIcons: ({ name }: { name: string }) => (
      <Text>{`mc-icon:${name}`}</Text>
    ),
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

const sampleDua: Dua = {
  id: 12,
  category: "anxiety",
  arabic: "arabic dua",
  english: "Allah is sufficient for us, and He is the best disposer of affairs.",
  transliteration: "Hasbunallahu wa nimal wakeel",
  reference: "Quran 3:173",
  source: "Quran",
};

describe("shared component UI contracts", () => {
  describe("DuaCard", () => {
    it("renders primary input contract and submit affordance", () => {
      const { getByLabelText, getByText } = render(
        <DuaCard onSubmit={jest.fn(async () => {})} />
      );

      expect(getByText("Ask for a Dua")).toBeTruthy();
      expect(getByLabelText("Dua request input")).toBeTruthy();
      expect(getByLabelText("Find dua")).toBeDisabled();
    });

    it("wires submit callback and clears the input after success", async () => {
      const onSubmit = jest.fn(async () => {});
      const { getByLabelText } = render(<DuaCard onSubmit={onSubmit} />);
      const input = getByLabelText("Dua request input");

      fireEvent.changeText(input, "Help me stay patient");
      fireEvent.press(getByLabelText("Find dua"));

      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith("Help me stay patient")
      );
      await waitFor(() => expect(getByLabelText("Dua request input").props.value).toBe(""));
    });
  });

  describe("DuaResultCard", () => {
    it("renders the dua content contract with formatted category", () => {
      const { getByText } = render(
        <DuaResultCard dua={sampleDua} onClose={jest.fn()} />
      );

      expect(getByText("Anxiety")).toBeTruthy();
      expect(getByText("Transliteration")).toBeTruthy();
      expect(getByText("English Translation")).toBeTruthy();
      expect(getByText(sampleDua.arabic)).toBeTruthy();
      expect(getByText(sampleDua.reference)).toBeTruthy();
    });

    it("wires close and share callbacks", async () => {
      const onClose = jest.fn();
      const shareSpy = jest
        .spyOn(Share, "share")
        .mockResolvedValueOnce({ action: "sharedAction" } as any);
      const { getByLabelText } = render(
        <DuaResultCard dua={sampleDua} onClose={onClose} />
      );

      fireEvent.press(getByLabelText("Close dua details"));
      expect(onClose).toHaveBeenCalledTimes(1);

      fireEvent.press(getByLabelText("Share dua"));
      await waitFor(() => expect(shareSpy).toHaveBeenCalledTimes(1));
      expect(shareSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Islamic Dua",
          message: expect.stringContaining(sampleDua.reference),
        })
      );
    });
  });

  describe("PrayerTimesList", () => {
    it("renders prayer rows and uses fallback icon for unknown labels", () => {
      const prayerTimes: PrayerTime[] = [
        { label: "Fajr", time: "5:11 AM" },
        { label: "Qiyam", time: "2:15 AM" },
      ];
      const { getByText } = render(
        <PrayerTimesList loading={false} prayerTimes={prayerTimes} />
      );

      expect(getByText("Fajr")).toBeTruthy();
      expect(getByText("5:11 AM")).toBeTruthy();
      expect(getByText("mc-icon:moon-waning-crescent")).toBeTruthy();
      expect(getByText("mc-icon:time-outline")).toBeTruthy();
    });
  });

  describe("CitySearchModal", () => {
    it("renders when visible and calls onSelectKey when a city is tapped", () => {
      const onSelectKey = jest.fn();
      const items = [
        { label: "San Francisco", value: "san-francisco" },
        { label: "New York", value: "new-york" },
      ];
      const { getByText } = render(
        <CitySearchModal
          visible
          onClose={jest.fn()}
          onSelectKey={onSelectKey}
          items={items}
        />
      );

      expect(getByText("Select city")).toBeTruthy();
      fireEvent.press(getByText("New York"));

      expect(onSelectKey).toHaveBeenCalledWith("new-york");
    });
  });
});
