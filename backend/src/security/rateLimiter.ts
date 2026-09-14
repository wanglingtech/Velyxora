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
  // Authentication has its own failure-aware limiter. These bootstrap endpoints
  // must not exhaust the general API budget merely by restoring a session.
  if (["/api/health", "/api/auth/me", "/api/auth/logout"].some((path) => req.path === path || req.path.startsWith(`${path}/`))) {
    next();
    return;
  }
  const clientIp = req.ip || req.socket.remoteAddress || "unknown-ip";
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
        message: "Hay demasiadas solicitudes. Espera un momento e inténtalo de nuevo.",
        retryAfter: Math.max(1, Math.ceil((record.resetTime - now) / 1000)),
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  next();
}
