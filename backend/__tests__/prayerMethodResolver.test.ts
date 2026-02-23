import { describe, expect, it } from "@jest/globals";
import { resolveAutoMethod } from "../src/utils/prayerMethodResolver.js";

describe("Prayer Method Resolver", () => {
  it("maps North America to ISNA", () => {
    const resolved = resolveAutoMethod("United States");
    expect(resolved).toEqual({
      method: 2,
      source: "auto-country",
    });
  });

  it("supports ISO-style compact inputs", () => {
    const resolved = resolveAutoMethod("TR");
    expect(resolved).toEqual({
      method: 13,
      source: "auto-country",
    });
  });

  it("falls back to MWL when no country is provided", () => {
    const resolved = resolveAutoMethod("");
    expect(resolved).toEqual({
      method: 3,
      source: "auto-fallback",
    });
  });

  it("falls back to MWL for unknown country names", () => {
    const resolved = resolveAutoMethod("Atlantis");
    expect(resolved).toEqual({
      method: 3,
      source: "auto-fallback",
    });
  });
});
