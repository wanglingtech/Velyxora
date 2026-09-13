import { Request, Response, NextFunction } from "express";
import { ENV } from "../config/env";
import { HTTP_STATUS } from "../config/constants";

interface ClientRecord {
  count: number;
  resetTime: number;
}

const clientHits = new Map<string, ClientRecord>();

// Clean up stale client records every 5 minutes
const cleanupTimer = setInterval(
  () => {
    const now = Date.now();
    for (const [ip, record] of clientHits.entries()) {
      if (now > record.resetTime) {
        clientHits.delete(ip);
      }
    }
  },
  5 * 60 * 1000,
);
cleanupTimer.unref();

export function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const clientIp =
    (req.headers["x-forwarded-for"] as string) ||
    req.socket.remoteAddress ||
    "unknown-ip";
  const now = Date.now();

  let record = clientHits.get(clientIp);
  if (!record || now > record.resetTime) {
    record = {
      count: 1,
      resetTime: now + ENV.RATE_LIMIT_WINDOW_MS,
    };
    clientHits.set(clientIp, record);
    return next();
  }

  record.count++;
  if (record.count > ENV.RATE_LIMIT_MAX_REQUESTS) {
    res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests. Please slow down and try again later.",
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  next();
}
