import type { Citation } from "@/services/chat/chatApi";
import { citationKey, gradeTone, sourceRefLine, surahLabel } from "@/services/chat/sources";

jest.mock("@/services/quranData", () => ({
  getSurahMeta: jest.fn(() => [{ surahNumber: 2, englishName: "Al-Baqarah" }]),
}));

const { getSurahMeta } = jest.requireMock("@/services/quranData") as { getSurahMeta: jest.Mock };

const quran = (surah: number, ayah: number): Citation => ({ kind: "quran", surah, ayah, arabic: "", english: null });
const hadith = (o: Partial<Extract<Citation, { kind: "hadith" }>> = {}): Citation => ({
  kind: "hadith", id: 1, title: "", text: "", arabic: null, grade: "Authentic hadith", source: "Bukhari 1", credit: "", ...o,
});
const dua = (o: Partial<Extract<Citation, { kind: "dua" }>> = {}): Citation => ({
  kind: "dua", id: 1, arabic: "", transliteration: "", english: "", reference: "Muslim 1", ...o,
});

it.each([
  ["Authentic hadith", "authentic"],
  ["Sahih/Authentic with all its versions", "authentic"],
  ["Sahīh (authentic) based on its overall chains of transmission", "authentic"],
  ["Good hadith", "good"],
  ["Hasan/Sound by virtue of corroborating evidence", "good"],
  ["No judgment by Shaykh Al-Albaani is available", "other"],
])("gradeTone(%s) is %s", (grade, tone) => expect(gradeTone(grade)).toBe(tone));

it("citationKey matches the server's id format", () => {
  expect([quran(2, 286), hadith({ id: 12 }), dua({ id: 3 })].map(citationKey)).toEqual(["q:2:286", "h:12", "d:3"]);
});

it("sourceRefLine formats each kind", () => {
  const name = () => "Al-Baqarah";
  expect(sourceRefLine(quran(2, 286), name)).toBe("Quran 2:286 (Al-Baqarah)");
  expect(sourceRefLine(hadith({ source: "Bukhari 386", grade: "Good hadith" }), name)).toBe("Bukhari 386 (Good hadith)");
  expect(sourceRefLine(dua({ reference: "Muslim 1342" }), name)).toBe("Muslim 1342");
});

describe("surahLabel", () => {
  it("uses the English name", () => expect(surahLabel(2)).toBe("Al-Baqarah"));
  it("falls back when the surah is unknown", () => expect(surahLabel(99)).toBe("Surah 99"));
  it("falls back instead of throwing when Quran data is not loaded", () => {
    getSurahMeta.mockImplementationOnce(() => {
      throw new Error("not preloaded");
    });
    expect(surahLabel(2)).toBe("Surah 2");
  });
});
