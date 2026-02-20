import dotenv from "dotenv";
import path from "path";
import { beforeAll, afterAll, jest } from "@jest/globals";

// Load .env file from backend directory
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

let logSpy: ReturnType<typeof jest.spyOn>;
let warnSpy: ReturnType<typeof jest.spyOn>;
let errorSpy: ReturnType<typeof jest.spyOn>;

beforeAll(() => {
  // Keep test output clean by suppressing expected runtime logging.
  logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  logSpy.mockRestore();
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});
