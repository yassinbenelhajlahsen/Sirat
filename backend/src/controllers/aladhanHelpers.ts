import { Request, Response } from "express";
import { AladhanServiceError } from "../services/aladhanService.js";

export function parseRequiredInteger(
  req: Request,
  key: string,
): number | { error: string } {
  const value = req.query[key];
  if (value === undefined) {
    return { error: `Missing required parameter: ${key}` };
  }

  const raw = String(value).trim();
  if (!/^-?\d+$/.test(raw)) {
    return { error: `Invalid ${key}: expected an integer` };
  }
  return Number.parseInt(raw, 10);
}

export function sendValidationError(res: Response, message: string) {
  return res.status(400).json({
    error: {
      code: "VALIDATION_ERROR",
      message,
      retriable: false,
    },
  });
}

/**
 * Builds the handler's error responder: Aladhan failures keep their code and status, anything
 * else is a 500 with a generic message. Both are logged under the endpoint's own event names.
 */
export function createServiceErrorSender(endpoint: {
  /** The `service` field on every log line, e.g. "prayer-times". */
  service: string;
  /** Prefix of the log event names, e.g. "prayer_times". */
  eventPrefix: string;
  failureMessage: string;
}) {
  const log = (req: Request, event: string, data: Record<string, unknown>) => {
    console.error(
      JSON.stringify({
        event,
        service: endpoint.service,
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
        userAgent: req.get("user-agent") ?? "unknown",
        ...data,
      }),
    );
  };

  return (req: Request, res: Response, error: unknown) => {
    if (error instanceof AladhanServiceError) {
      log(req, `${endpoint.eventPrefix}_service_error`, {
        code: error.code,
        message: error.message,
        status: error.status,
        retriable: error.retriable,
        query: req.query,
      });

      return res.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
          retriable: error.retriable,
        },
        stale: false,
      });
    }

    const unknownError =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack ?? null,
          }
        : {
            value: String(error),
          };

    log(req, `${endpoint.eventPrefix}_unexpected_error`, {
      error: unknownError,
      query: req.query,
    });

    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: endpoint.failureMessage,
        retriable: false,
      },
      stale: false,
    });
  };
}
