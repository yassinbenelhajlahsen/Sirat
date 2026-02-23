export type MethodResolutionSource = "auto-country" | "auto-fallback";

type MethodResolution = {
  method: number;
  source: MethodResolutionSource;
};

const METHOD_IDS = {
  KARACHI: 1,
  ISNA: 2,
  MWL: 3,
  UMM_AL_QURA: 4,
  EGYPTIAN: 5,
  DIYANET: 13,
} as const;

function normalizeCountryInput(countryInput: string): {
  raw: string;
  compact: string;
} {
  const raw = countryInput.trim().toLowerCase();
  const compact = raw.replace(/[^a-z]/g, "");
  return { raw, compact };
}

function hasAny(raw: string, values: readonly string[]): boolean {
  return values.some((value) => raw.includes(value));
}

function equalsAny(compact: string, values: readonly string[]): boolean {
  return values.some((value) => compact === value);
}

export function resolveAutoMethod(countryInput: string): MethodResolution {
  const { raw, compact } = normalizeCountryInput(countryInput);

  if (
    hasAny(raw, ["saudi", "saudi arabia"]) ||
    equalsAny(compact, ["sa", "ksa", "saudiarabia"])
  ) {
    return { method: METHOD_IDS.UMM_AL_QURA, source: "auto-country" };
  }

  if (hasAny(raw, ["egypt"]) || equalsAny(compact, ["eg", "egy", "egypt"])) {
    return { method: METHOD_IDS.EGYPTIAN, source: "auto-country" };
  }

  if (
    hasAny(raw, ["pakistan", "india", "bangladesh"]) ||
    equalsAny(compact, ["pk", "pak", "in", "ind", "bd", "bgd"])
  ) {
    return { method: METHOD_IDS.KARACHI, source: "auto-country" };
  }

  if (
    hasAny(raw, ["turkey", "turkiye"]) ||
    equalsAny(compact, ["tr", "tur", "turkiye", "turkey"])
  ) {
    return { method: METHOD_IDS.DIYANET, source: "auto-country" };
  }

  if (
    hasAny(raw, ["north america", "united states", "canada"]) ||
    equalsAny(compact, ["us", "usa", "unitedstates", "ca", "can", "canada"])
  ) {
    return { method: METHOD_IDS.ISNA, source: "auto-country" };
  }

  if (
    hasAny(raw, ["uk", "united kingdom", "australia"]) ||
    equalsAny(
      compact,
      ["uk", "gb", "gbr", "unitedkingdom", "au", "aus", "australia"],
    )
  ) {
    return { method: METHOD_IDS.MWL, source: "auto-country" };
  }

  return {
    method: METHOD_IDS.MWL,
    source: "auto-fallback",
  };
}
