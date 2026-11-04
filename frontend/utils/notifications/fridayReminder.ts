export const FRIDAY_TITLE = "Jumu'ah Mubarak";
export const FRIDAY_URL = "/Quran?surah=18&ayah=1";

// Every message must point at Surah Al-Kahf, since the tap opens it.
export const FRIDAY_MESSAGES = [
  "A good day to read Surah Al-Kahf.",
  "Jumu'ah is here. Surah Al-Kahf is ready whenever you are.",
  "May your Friday be blessed. Surah Al-Kahf is a lovely way to begin it.",
  "Take a quiet moment today for Surah Al-Kahf.",
  "It is Friday. Why not read a little of Surah Al-Kahf?",
  "Jumu'ah blessings. Open Surah Al-Kahf when you have a moment.",
  "A light between two Fridays: Surah Al-Kahf.",
  "Friday reminder: Surah Al-Kahf is one tap away.",
  "Start your Jumu'ah with Surah Al-Kahf.",
  "Whenever it suits your day, Surah Al-Kahf is waiting for you.",
];

const WINDOW_START_HOUR = 9;
const WINDOW_MINUTES = 120; // 9:00 up to 10:59

// The scheduler reruns many times a week and dedupes on the fire time, so the
// pick must be the same for a given Friday every time: random across weeks,
// stable within one. FNV-1a over the date gives that.
function hashDate(day: Date): number {
  const text = `friday-${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function fridayReminderFor(day: Date): { fireDate: Date; body: string } {
  const h = hashDate(day);
  const minute = h % WINDOW_MINUTES;
  const body = FRIDAY_MESSAGES[Math.floor(h / WINDOW_MINUTES) % FRIDAY_MESSAGES.length];
  return {
    fireDate: new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      WINDOW_START_HOUR,
      minute,
      0,
      0,
    ),
    body,
  };
}
