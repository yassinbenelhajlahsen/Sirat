import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Share, StyleSheet } from "react-native";

import DuaResultCard, { CRISIS_MESSAGE, NO_MATCH_MESSAGE } from "@/components/DuaResultCard";
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

  it("tells the screen when copy is pressed instead of showing its own toast", () => {
    const onCopied = jest.fn();
    const { getByLabelText, queryByText } = render(
      <DuaResultCard dua={sampleDua} onClose={jest.fn()} onCopied={onCopied} />
    );

    fireEvent.press(getByLabelText("Copy dua"));

    expect(onCopied).toHaveBeenCalledTimes(1);
    expect(queryByText("Copied to clipboard")).toBeNull();
  });

  it("shows the exact support message above the dua for the crisis notice", () => {
    const { getByText, getByRole } = render(
      <DuaResultCard dua={sampleDua} onClose={jest.fn()} onAnother={jest.fn()} notice="crisis" />
    );

    expect(getByText(CRISIS_MESSAGE)).toBeTruthy();
    expect(CRISIS_MESSAGE).toBe(
      "You don't have to face this alone. If you might hurt yourself, or someone is hurting you, call your local emergency number or a crisis line now, and reach out to someone you trust.",
    );
    expect(getByRole("alert")).toBeTruthy();
  });

  it("shows the no-match line and a Browse all duas action", () => {
    const onBrowse = jest.fn();
    const { getByText, getByLabelText } = render(
      <DuaResultCard dua={sampleDua} onClose={jest.fn()} notice="no-match" onBrowse={onBrowse} />
    );

    expect(getByText("We couldn't find a close match.")).toBeTruthy();
    fireEvent.press(getByLabelText("Browse all duas"));
    expect(onBrowse).toHaveBeenCalledTimes(1);
  });

  it("centers the no-match line and the Browse all duas button", () => {
    const { getByText, getByLabelText } = render(
      <DuaResultCard dua={sampleDua} onClose={jest.fn()} notice="no-match" onBrowse={jest.fn()} />
    );

    expect(StyleSheet.flatten(getByText(NO_MATCH_MESSAGE).props.style).textAlign).toBe("center");
    let node: any = getByLabelText("Browse all duas");
    while (node && StyleSheet.flatten(node.props.style)?.alignSelf !== "center") node = node.parent;
    expect(node).toBeTruthy();
  });

  it("never shows the no-match line or Browse button next to the crisis message", () => {
    const { getByText, queryByText, queryByLabelText } = render(
      <DuaResultCard dua={sampleDua} onClose={jest.fn()} onBrowse={jest.fn()} notice="crisis" />
    );

    expect(getByText(CRISIS_MESSAGE)).toBeTruthy();
    expect(queryByText(NO_MATCH_MESSAGE)).toBeNull();
    expect(queryByLabelText("Browse all duas")).toBeNull();
  });

  it("shows no notice for a normal match", () => {
    const { queryByText, queryByRole, queryByLabelText } = render(
      <DuaResultCard dua={sampleDua} onClose={jest.fn()} onBrowse={jest.fn()} notice={null} />
    );

    expect(queryByText(CRISIS_MESSAGE)).toBeNull();
    expect(queryByText(NO_MATCH_MESSAGE)).toBeNull();
    expect(queryByRole("alert")).toBeNull();
    expect(queryByLabelText("Browse all duas")).toBeNull();
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

  it("toggles the saved state from the bookmark button", async () => {
    const { getByLabelText, findByLabelText } = render(
      <DuaResultCard dua={sampleDua} onClose={jest.fn()} />
    );

    fireEvent.press(getByLabelText("Save dua"));
    fireEvent.press(await findByLabelText("Remove from saved duas"));

    expect(await findByLabelText("Save dua")).toBeTruthy();
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
