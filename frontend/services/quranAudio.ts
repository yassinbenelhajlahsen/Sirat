export type QuranReciter = {
  id: string;
  name: string;
  path: string;
};

export const QURAN_RECITERS: readonly QuranReciter[] = [
  { id: "alafasy", name: "Mishary Alafasy", path: "mishaari_raashid_al_3afaasee" },
  { id: "abdul-basit", name: "Abdul Basit", path: "abdul_basit_murattal" },
  { id: "sudais", name: "Abdur-Rahman As-Sudais", path: "abdurrahmaan_as-sudays" },
  { id: "husary", name: "Mahmoud Khalil Al-Husary", path: "mahmood_khaleel_al-husaree" },
  { id: "minshawi", name: "Muhammad Siddiq Al-Minshawi", path: "muhammad_siddeeq_al-minshaawee" },
  { id: "muaiqly", name: "Maher Al-Muaiqly", path: "maher_256" },
  { id: "shuraim", name: "Saud Ash-Shuraim", path: "sa3ood_al-shuraym" },
  { id: "dosari", name: "Yasser Al-Dosari", path: "yasser_ad-dussary" },
];

export const DEFAULT_QURAN_RECITER_ID = QURAN_RECITERS[0].id;

export function sanitizeQuranReciterId(input: unknown): string {
  return QURAN_RECITERS.some((r) => r.id === input)
    ? (input as string)
    : DEFAULT_QURAN_RECITER_ID;
}

export function getSurahAudioUrl(
  surahNumber: number,
  reciterId: string = DEFAULT_QURAN_RECITER_ID
): string {
  const reciter = QURAN_RECITERS.find((r) => r.id === reciterId) ?? QURAN_RECITERS[0];
  const padded = String(surahNumber).padStart(3, "0");
  return `https://download.quranicaudio.com/quran/${reciter.path}/${padded}.mp3`;
}
