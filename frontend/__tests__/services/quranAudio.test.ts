import {
  DEFAULT_QURAN_RECITER_ID,
  QURAN_RECITERS,
  getSurahAudioUrl,
  sanitizeQuranReciterId,
} from "@/services/quranAudio";

describe("quranAudio", () => {
  it("has 8 reciters with Alafasy first as the default", () => {
    expect(QURAN_RECITERS).toHaveLength(8);
    expect(DEFAULT_QURAN_RECITER_ID).toBe("alafasy");
  });

  it("builds a zero-padded QuranicAudio URL for every reciter", () => {
    for (const r of QURAN_RECITERS) {
      expect(getSurahAudioUrl(1, r.id)).toBe(
        `https://download.quranicaudio.com/quran/${r.path}/001.mp3`
      );
      expect(getSurahAudioUrl(18, r.id)).toContain("/018.mp3");
      expect(getSurahAudioUrl(114, r.id)).toContain("/114.mp3");
    }
  });

  it("falls back to Alafasy for an unknown or missing reciter", () => {
    const expected = "https://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/002.mp3";
    expect(getSurahAudioUrl(2)).toBe(expected);
    expect(getSurahAudioUrl(2, "nope")).toBe(expected);
    expect(sanitizeQuranReciterId("nope")).toBe("alafasy");
    expect(sanitizeQuranReciterId(null)).toBe("alafasy");
    expect(sanitizeQuranReciterId("husary")).toBe("husary");
  });
});
