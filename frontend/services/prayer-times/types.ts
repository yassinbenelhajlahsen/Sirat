import { City } from "../../utils/cities";

export interface PrayerSettings {
  useLocation: boolean;
  method: number;
  city?: City;
}

export interface PrayerTime {
  label: "Fajr" | "Sunrise" | "Dhuhr" | "Asr" | "Maghrib" | "Isha" | string;
  time: string;
}

export type BackendErrorShape = {
  error?:
    | {
        code?: string;
        message?: string;
      }
    | string;
};

export type BackendProxyResponse<T> = {
  success?: boolean;
  data?: T;
} & BackendErrorShape;

export type RequiredTimingMap = {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
};

export type BackendTimingsPayload = {
  timings?: RequiredTimingMap;
};

export type BackendCalendarDay = {
  date?: {
    gregorian?: {
      date?: string;
    };
  };
  timings?: RequiredTimingMap;
};

export type BackendCalendarYearPayload = {
  days?: BackendCalendarDay[];
};

export type PrayerMethodParam = number | "auto";

export type ResolvedEnv = {
  latitude: number;
  longitude: number;
  country: string;
  bucket: string;
};

export type CalendarCache = {
  cacheKey: string;
  year: number;
  data: Record<string, PrayerTime[]>;
};

export type PrayerLocationOverride = {
  coords?: { latitude: number; longitude: number };
  country?: string;
};
