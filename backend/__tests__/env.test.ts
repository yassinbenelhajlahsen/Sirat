import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

describe("ENV configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should use default values when env vars are not set", async () => {
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    delete process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.FRONTEND_URL;
    delete process.env.LOG_LEVEL;
    delete process.env.MIN_SUPPORTED_APP_VERSION;
    delete process.env.ENFORCE_MIN_VERSION;

    const { ENV } = await import("../src/config/env.js");

    expect(ENV.PORT).toBe(3001);
    expect(ENV.NODE_ENV).toBe("development");
    expect(ENV.OPENAI_API_KEY).toBe("");
    expect(ENV.OPENAI_MODEL).toBe("gpt-4-turbo");
    expect(ENV.GOOGLE_MAPS_API_KEY).toBe("");
    expect(ENV.FRONTEND_URL).toBe("http://localhost:8081");
    expect(ENV.LOG_LEVEL).toBe("info");
    expect(ENV.MIN_SUPPORTED_APP_VERSION).toBe("1.0.0");
    expect(ENV.ENFORCE_MIN_VERSION).toBe("false");
  });

  it("should use custom values when env vars are set", async () => {
    process.env.PORT = "4000";
    process.env.NODE_ENV = "production";
    process.env.OPENAI_API_KEY = "custom-key";
    process.env.OPENAI_MODEL = "gpt-3.5-turbo";
    process.env.GOOGLE_MAPS_API_KEY = "custom-google-key";
    process.env.FRONTEND_URL = "https://example.com";
    process.env.LOG_LEVEL = "debug";
    process.env.MIN_SUPPORTED_APP_VERSION = "2.0.0";
    process.env.ENFORCE_MIN_VERSION = "true";

    const { ENV } = await import("../src/config/env.js");

    expect(ENV.PORT).toBe("4000");
    expect(ENV.NODE_ENV).toBe("production");
    expect(ENV.OPENAI_API_KEY).toBe("custom-key");
    expect(ENV.OPENAI_MODEL).toBe("gpt-3.5-turbo");
    expect(ENV.GOOGLE_MAPS_API_KEY).toBe("custom-google-key");
    expect(ENV.FRONTEND_URL).toBe("https://example.com");
    expect(ENV.LOG_LEVEL).toBe("debug");
    expect(ENV.MIN_SUPPORTED_APP_VERSION).toBe("2.0.0");
    expect(ENV.ENFORCE_MIN_VERSION).toBe("true");
  });

  it("should handle missing OPENAI_API_KEY gracefully", async () => {
    delete process.env.OPENAI_API_KEY;

    const { ENV } = await import("../src/config/env.js");

    expect(ENV.OPENAI_API_KEY).toBe("");
  });
});
