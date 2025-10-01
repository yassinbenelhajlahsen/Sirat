// crude country mapping
export function resolveAutoMethod(countryName: string): number {
  const country = countryName.toLowerCase();

  if (country.includes("saudi")) return 4; // Umm al-Qura
  if (country.includes("egypt")) return 5; // Egyptian Authority
  if (country.includes("pakistan")) return 1; // Karachi
  if (country.includes("india") || country.includes("bangladesh")) return 1;
  if (country.includes("turkey")) return 13; // Diyanet
  if (country.includes("north america") || country.includes("united states") || country.includes("canada"))
    return 2; // ISNA
  if (country.includes("uk") || country.includes("australia"))
    return 3; // MWL
  return 3; // fallback: MWL
}
