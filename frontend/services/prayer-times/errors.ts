/** Prayer times cannot be worked out because there is no usable location or saved city. */
export class LocationUnavailableError extends Error {
  readonly code = "LOCATION_UNAVAILABLE";

  constructor(
    message = "Location unavailable. Enable Location Services or set a manual city in Settings.",
  ) {
    super(message);
    this.name = "LocationUnavailableError";
  }
}

// Checked by code rather than instanceof: Error subclasses do not survive every transpile target.
export function isLocationUnavailable(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "LOCATION_UNAVAILABLE";
}
