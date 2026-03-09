import { describe, expect, it } from "@jest/globals";
import { isVersionLessThan } from "../src/utils/semver.js";

describe("isVersionLessThan", () => {
  it("returns false when versions are equal", () => {
    expect(isVersionLessThan("1.0.10", "1.0.10")).toBe(false);
    expect(isVersionLessThan("2.5.3", "2.5.3")).toBe(false);
    expect(isVersionLessThan("0.0.0", "0.0.0")).toBe(false);
  });

  it("returns false when current is newer", () => {
    expect(isVersionLessThan("1.0.11", "1.0.10")).toBe(false);
    expect(isVersionLessThan("1.1.0", "1.0.10")).toBe(false);
    expect(isVersionLessThan("2.0.0", "1.9.9")).toBe(false);
  });

  it("returns true when current is older (patch)", () => {
    expect(isVersionLessThan("1.0.9", "1.0.10")).toBe(true);
  });

  it("returns true when current is older (minor)", () => {
    expect(isVersionLessThan("1.0.99", "1.1.0")).toBe(true);
  });

  it("returns true when current is older (major)", () => {
    expect(isVersionLessThan("0.9.9", "1.0.0")).toBe(true);
  });

  it("returns true for non-numeric current version (treat as outdated)", () => {
    expect(isVersionLessThan("not-a-version", "1.0.0")).toBe(true);
    expect(isVersionLessThan("abc.def.ghi", "1.0.0")).toBe(true);
  });

  it("returns true for non-numeric minimum version (treat as outdated)", () => {
    expect(isVersionLessThan("1.0.0", "bad-version")).toBe(true);
  });

  it("returns true for versions with wrong segment count", () => {
    expect(isVersionLessThan("1.0", "1.0.0")).toBe(true);
    expect(isVersionLessThan("1.0.0.0", "1.0.0")).toBe(true);
    expect(isVersionLessThan("1.0.0", "1.0")).toBe(true);
  });
});
