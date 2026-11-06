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

    const { ENV } = await import("../src/config/env.js");

    expect(ENV.PORT).toBe(3001);
    expect(ENV.NODE_ENV).toBe("development");
    expect(ENV.OPENAI_API_KEY).toBe("");
    expect(ENV.OPENAI_MODEL).toBe("gpt-6-luna");
    expect(ENV.GOOGLE_MAPS_API_KEY).toBe("");
    expect(ENV.FRONTEND_URL).toBe("http://localhost:8081");
    expect(ENV.LOG_LEVEL).toBe("info");
    expect(ENV.MIN_SUPPORTED_APP_VERSION).toBe("1.0.0");
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

    const { ENV } = await import("../src/config/env.js");

    expect(ENV.PORT).toBe("4000");
    expect(ENV.NODE_ENV).toBe("production");
    expect(ENV.OPENAI_API_KEY).toBe("custom-key");
    expect(ENV.OPENAI_MODEL).toBe("gpt-3.5-turbo");
    expect(ENV.GOOGLE_MAPS_API_KEY).toBe("custom-google-key");
    expect(ENV.FRONTEND_URL).toBe("https://example.com");
    expect(ENV.LOG_LEVEL).toBe("debug");
    expect(ENV.MIN_SUPPORTED_APP_VERSION).toBe("2.0.0");
  });

  it("should handle missing OPENAI_API_KEY gracefully", async () => {
    delete process.env.OPENAI_API_KEY;

    const { ENV } = await import("../src/config/env.js");

    expect(ENV.OPENAI_API_KEY).toBe("");
  });

  it("defaults the chat settings to off and safe", async () => {
    for (const k of ["CHAT_ENABLED", "CHAT_IDENTITY_SECRET", "CHAT_QURAN_QUOTES", "CHAT_SCHOLAR_LINK", "OPENAI_MODERATION_MODEL", "DEVICECHECK_REQUIRED", "DEVICECHECK_ENV", "DEVICECHECK_PRIVATE_KEY"]) {
      delete process.env[k];
    }

    const { ENV } = await import("../src/config/env.js");

    expect(ENV.CHAT_ENABLED).toBe(false);
    expect(ENV.CHAT_IDENTITY_SECRET).toBe("");
    expect(ENV.CHAT_QURAN_QUOTES).toBe("text");
    expect(ENV.CHAT_SCHOLAR_LINK).toBe("https://seekersguidance.org/answers/");
    expect(ENV.OPENAI_MODERATION_MODEL).toBe("omni-moderation-latest");
    expect(ENV.DEVICECHECK_REQUIRED).toBe(true);
    expect(ENV.DEVICECHECK_ENV).toBe("production");
    expect(ENV.DEVICECHECK_PRIVATE_KEY).toBe("");
  });

  it("reads the chat switches", async () => {
    process.env.CHAT_ENABLED = "1";
    process.env.DEVICECHECK_REQUIRED = "0";
    process.env.DEVICECHECK_ENV = "development";
    process.env.CHAT_QURAN_QUOTES = "reference";

    const { ENV } = await import("../src/config/env.js");

    expect(ENV.CHAT_ENABLED).toBe(true);
    expect(ENV.DEVICECHECK_REQUIRED).toBe(false);
    expect(ENV.DEVICECHECK_ENV).toBe("development");
    expect(ENV.CHAT_QURAN_QUOTES).toBe("reference");
  });

  it("only turns chat on for exactly \"1\"", async () => {
    process.env.CHAT_ENABLED = "true";

    const { ENV } = await import("../src/config/env.js");

    expect(ENV.CHAT_ENABLED).toBe(false);
  });

  it("unescapes \\n in the DeviceCheck private key", async () => {
    process.env.DEVICECHECK_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----";

    const { ENV } = await import("../src/config/env.js");

    expect(ENV.DEVICECHECK_PRIVATE_KEY).toBe("-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----");
  });
});
