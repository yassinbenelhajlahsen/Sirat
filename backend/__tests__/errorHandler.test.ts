import { describe, expect, it, jest } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";
import { errorHandler } from "../src/middleware/errorHandler.js";

describe("errorHandler middleware", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock<any>;
  let statusMock: jest.Mock<any>;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      path: "/test",
      method: "GET",
    };

    mockRes = {
      json: jsonMock as any,
      status: statusMock as any,
    };

    mockNext = jest.fn() as any;

    jest.clearAllMocks();
  });

  it("should handle errors with custom status code", () => {
    const error = {
      status: 404,
      message: "Not found",
    };

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({
      error: "Not found",
      timestamp: expect.any(String),
    });
  });

  it("should handle errors with default 500 status", () => {
    const error = {
      message: "Something went wrong",
    };

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      error: "Something went wrong",
      timestamp: expect.any(String),
    });
  });

  it("should handle errors without message", () => {
    const error = {};

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      error: "Internal server error",
      timestamp: expect.any(String),
    });
  });

  it("should include valid ISO timestamp", () => {
    const error = {
      message: "Test error",
    };

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    const response = jsonMock.mock.calls[0][0] as any;
    const timestamp = new Date(response.timestamp);
    expect(timestamp.toISOString()).toBe(response.timestamp);
  });

  it("should handle Error instances", () => {
    const error = new Error("Standard error");
    (error as any).status = 400;

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      error: "Standard error",
      timestamp: expect.any(String),
    });
  });

  it("should handle string errors", () => {
    const error = "String error message";

    errorHandler(
      error as any,
      mockReq as Request,
      mockRes as Response,
      mockNext,
    );

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      error: "Internal server error",
      timestamp: expect.any(String),
    });
  });
});
