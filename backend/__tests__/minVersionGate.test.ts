import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import type { NextFunction, Request, Response } from "express";

function buildReq(
  path: string,
  headers: Record<string, string> = {},
): Partial<Request> {
  return { path, headers } as Partial<Request>;
}

function buildRes(): {
  res: Partial<Response>;
  statusMock: jest.Mock<any>;
  jsonMock: jest.Mock<any>;
} {
  const jsonMock = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  return {
    res: { status: statusMock as any, json: jsonMock as any },
    statusMock,
    jsonMock,
  };
}

describe("minVersionGate middleware", () => {
  const originalEnv = process.env;
  let nextMock: jest.Mock<any>;
  let consoleSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    nextMock = jest.fn() as any;
    consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    consoleSpy.mockRestore();
  });

  async function loadMiddleware() {
    const { minVersionGate } = await import(
      "../src/middleware/minVersionGate.js"
    );
    return minVersionGate;
  }

  describe("exempt paths", () => {
    it("passes through GET /", async () => {
      process.env.ENFORCE_MIN_VERSION = "true";
      process.env.MIN_SUPPORTED_APP_VERSION = "99.0.0";
      const mw = await loadMiddleware();
      const { res } = buildRes();

      mw(buildReq("/") as Request, res as Response, nextMock as NextFunction);

      expect(nextMock).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("passes through /api/app/version", async () => {
      process.env.ENFORCE_MIN_VERSION = "true";
      process.env.MIN_SUPPORTED_APP_VERSION = "99.0.0";
      const mw = await loadMiddleware();
      const { res } = buildRes();

      mw(
        buildReq("/api/app/version") as Request,
        res as Response,
        nextMock as NextFunction,
      );

      expect(nextMock).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("passes through any /health path", async () => {
      process.env.ENFORCE_MIN_VERSION = "true";
      process.env.MIN_SUPPORTED_APP_VERSION = "99.0.0";
      const mw = await loadMiddleware();

      for (const path of [
        "/api/dua/health",
        "/api/mosque/health",
        "/api/prayer-times/health",
        "/api/holidays/health",
      ]) {
        const { res } = buildRes();
        const next = jest.fn() as any;
        mw(buildReq(path) as Request, res as Response, next as NextFunction);
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
      }
    });
  });

  describe("monitor mode (ENFORCE_MIN_VERSION=false)", () => {
    it("passes all requests through, including missing headers", async () => {
      process.env.ENFORCE_MIN_VERSION = "false";
      const mw = await loadMiddleware();
      const { res } = buildRes();

      mw(
        buildReq("/api/dua") as Request,
        res as Response,
        nextMock as NextFunction,
      );

      expect(nextMock).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("passes outdated versions through in monitor mode", async () => {
      process.env.ENFORCE_MIN_VERSION = "false";
      process.env.MIN_SUPPORTED_APP_VERSION = "99.0.0";
      const mw = await loadMiddleware();
      const { res } = buildRes();

      mw(
        buildReq("/api/dua", {
          "x-sirat-app-version": "0.0.1",
        }) as Request,
        res as Response,
        nextMock as NextFunction,
      );

      expect(nextMock).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("logs version info in monitor mode", async () => {
      process.env.ENFORCE_MIN_VERSION = "false";
      const mw = await loadMiddleware();
      const { res } = buildRes();

      mw(
        buildReq("/api/dua", {
          "x-sirat-app-version": "1.0.10",
          "x-sirat-platform": "ios",
        }) as Request,
        res as Response,
        nextMock as NextFunction,
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("1.0.10"),
      );
    });
  });

  describe("enforcement mode (ENFORCE_MIN_VERSION=true)", () => {
    it("passes through a current version", async () => {
      process.env.ENFORCE_MIN_VERSION = "true";
      process.env.MIN_SUPPORTED_APP_VERSION = "1.0.10";
      const mw = await loadMiddleware();
      const { res } = buildRes();

      mw(
        buildReq("/api/dua", { "x-sirat-app-version": "1.0.10" }) as Request,
        res as Response,
        nextMock as NextFunction,
      );

      expect(nextMock).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("passes through a newer version", async () => {
      process.env.ENFORCE_MIN_VERSION = "true";
      process.env.MIN_SUPPORTED_APP_VERSION = "1.0.10";
      const mw = await loadMiddleware();
      const { res } = buildRes();

      mw(
        buildReq("/api/dua", { "x-sirat-app-version": "1.0.11" }) as Request,
        res as Response,
        nextMock as NextFunction,
      );

      expect(nextMock).toHaveBeenCalledTimes(1);
    });

    it("returns 426 for an outdated version", async () => {
      process.env.ENFORCE_MIN_VERSION = "true";
      process.env.MIN_SUPPORTED_APP_VERSION = "1.0.10";
      const mw = await loadMiddleware();
      const { res, statusMock, jsonMock } = buildRes();

      mw(
        buildReq("/api/dua", { "x-sirat-app-version": "1.0.9" }) as Request,
        res as Response,
        nextMock as NextFunction,
      );

      expect(nextMock).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(426);
      const body = jsonMock.mock.calls[0][0] as any;
      expect(body.error.code).toBe("APP_UPDATE_REQUIRED");
      expect(body.error.minVersion).toBe("1.0.10");
      expect(body.error.currentVersion).toBe("1.0.9");
      expect(body.error.retriable).toBe(false);
    });

    it("returns 426 when version header is missing", async () => {
      process.env.ENFORCE_MIN_VERSION = "true";
      process.env.MIN_SUPPORTED_APP_VERSION = "1.0.10";
      const mw = await loadMiddleware();
      const { res, statusMock, jsonMock } = buildRes();

      mw(
        buildReq("/api/dua") as Request,
        res as Response,
        nextMock as NextFunction,
      );

      expect(nextMock).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(426);
      const body = jsonMock.mock.calls[0][0] as any;
      expect(body.error.currentVersion).toBe("unknown");
    });

    it("does not include storeUrl in the 426 response", async () => {
      process.env.ENFORCE_MIN_VERSION = "true";
      process.env.MIN_SUPPORTED_APP_VERSION = "99.0.0";
      const mw = await loadMiddleware();
      const { res, jsonMock } = buildRes();

      mw(
        buildReq("/api/dua", { "x-sirat-app-version": "1.0.0" }) as Request,
        res as Response,
        nextMock as NextFunction,
      );

      const body = jsonMock.mock.calls[0][0] as any;
      expect(body.error.storeUrl).toBeUndefined();
    });
  });
});
