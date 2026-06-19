import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Share } from "react-native";

import DuaResultCard from "@/components/DuaResultCard";
import type { Dua } from "@/services/duaService";

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

const sampleDua: Dua = {
  id: 12,
  category: "anxiety",
  arabic: "حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ",
  english: "Allah is sufficient for us, and He is the best disposer of affairs.",
  transliteration: "Hasbunallahu wa ni'mal wakeel",
  reference: "Qur'an 3:173",
  source: "Qur'an",
};

describe("DuaResultCard contract", () => {
  it("renders the dua, category eyebrow, and translation by default", () => {
    const { getByText, queryByText } = render(
      <DuaResultCard dua={sampleDua} onClose={jest.fn()} />
    );

    expect(getByText("Anxiety")).toBeTruthy();
    expect(getByText("Translation")).toBeTruthy();
    expect(getByText("Transliteration")).toBeTruthy();
    expect(getByText(sampleDua.arabic)).toBeTruthy();
    expect(getByText(sampleDua.reference)).toBeTruthy();
    // Translation is the default mode; the transliteration text is hidden.
    expect(getByText(sampleDua.english)).toBeTruthy();
    expect(queryByText(sampleDua.transliteration)).toBeNull();
  });

  it("toggles to transliteration via the segmented control", () => {
    const { getByText, queryByText } = render(
      <DuaResultCard dua={sampleDua} onClose={jest.fn()} />
    );

    fireEvent.press(getByText("Transliteration"));

    expect(getByText(sampleDua.transliteration)).toBeTruthy();
    expect(queryByText(sampleDua.english)).toBeNull();
  });

  it("wires close button callback", () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(
      <DuaResultCard dua={sampleDua} onClose={onClose} />
    );

    fireEvent.press(getByLabelText("Close dua details"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows a toast when copy is pressed", () => {
    const { getByLabelText, getByText } = render(
      <DuaResultCard dua={sampleDua} onClose={jest.fn()} />
    );

    fireEvent.press(getByLabelText("Copy dua"));

    expect(getByText("Copied to clipboard")).toBeTruthy();
  });

  it("renders find-another only when onAnother is provided and wires it", () => {
    const onAnother = jest.fn();
    const withAnother = render(
      <DuaResultCard dua={sampleDua} onClose={jest.fn()} onAnother={onAnother} />
    );

    fireEvent.press(withAnother.getByLabelText("Find another dua"));
    expect(onAnother).toHaveBeenCalledTimes(1);

    const withoutAnother = render(
      <DuaResultCard dua={sampleDua} onClose={jest.fn()} />
    );
    expect(withoutAnother.queryByLabelText("Find another dua")).toBeNull();
  });

  it("wires share button with expected payload", async () => {
    const shareSpy = jest
      .spyOn(Share, "share")
      .mockResolvedValueOnce({ action: "sharedAction" } as any);
    const { getByLabelText } = render(
      <DuaResultCard dua={sampleDua} onClose={jest.fn()} />
    );

    fireEvent.press(getByLabelText("Share dua"));

    await waitFor(() => expect(shareSpy).toHaveBeenCalledTimes(1));
    const sharePayload = shareSpy.mock.calls[0]?.[0] as {
      message: string;
      title: string;
    };

    expect(sharePayload.title).toBe("Islamic Dua");
    expect(sharePayload.message).toContain(sampleDua.arabic);
    expect(sharePayload.message).toContain(sampleDua.transliteration);
    expect(sharePayload.message).toContain(sampleDua.english);
    expect(sharePayload.message).toContain(sampleDua.reference);
  });

  it("handles share errors without crashing", async () => {
    const shareSpy = jest
      .spyOn(Share, "share")
      .mockRejectedValueOnce(new Error("share failed"));
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(jest.fn());
    const { getByLabelText } = render(
      <DuaResultCard dua={sampleDua} onClose={jest.fn()} />
    );

    fireEvent.press(getByLabelText("Share dua"));

    await waitFor(() => expect(shareSpy).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(consoleSpy).toHaveBeenCalledWith("Share error:", expect.any(Error))
    );
  });
});
