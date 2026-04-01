import type { Request, Response, NextFunction } from "express";

type Bucket = {
  windowMs: number;
  max: number;
  hits: number[];
};

const buckets = new Map<string, Bucket>();

function now() {
  return Date.now();
}

function getKey(req: Request, action: string, byIp: boolean) {
  if (byIp) {
    // For unauthenticated endpoints (auth/request, auth/verify) use the client IP
    // so different users don't share a single rate-limit bucket.
    const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    return `${action}:ip:${ip}`;
  }
  const userId = req.user?.id ?? "anon";
  const courseId = req.params.courseId ?? "no-course";
  const targetId = (req.body?.targetId as string | undefined) ?? "no-target";
  return `${action}:${userId}:${courseId}:${targetId}`;
}

function cleanup(bucket: Bucket) {
  const cutoff = now() - bucket.windowMs;
  bucket.hits = bucket.hits.filter((t) => t > cutoff);
}

const HOUR_MS = 60 * 60 * 1000;
const NEW_ACCOUNT_WINDOW_MS = 24 * HOUR_MS;

/**
 * Returns a middleware that applies a tighter rate limit for accounts younger
 * than 24 hours (new_max), falling through to the normal limit otherwise.
 * Both limits use the same in-memory bucket store as `rateLimit`.
 */
export function newAccountRateLimit(
  action: string,
  windowMs: number,
  normalMax: number,
  newMax: number,
) {
  const normalLimit = rateLimit(action, windowMs, normalMax);
  const tightLimit = rateLimit(`${action}_new`, windowMs, newMax);

  return (req: Request, res: Response, next: NextFunction) => {
    const createdAt = req.user?.createdAt;
    if (createdAt && now() - createdAt.getTime() < NEW_ACCOUNT_WINDOW_MS) {
      return tightLimit(req, res, next);
    }
    return normalLimit(req, res, next);
  };
}

/**
 * @param byIp – pass `true` for endpoints that run before auth (login/verify).
 *               Uses req.ip so every visitor gets their own bucket instead of
 *               all anonymous requests sharing one.
 */
export function rateLimit(action: string, windowMs: number, max: number, byIp = false) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = getKey(req, action, byIp);

    const bucket = buckets.get(key) ?? { windowMs, max, hits: [] };
    bucket.windowMs = windowMs;
    bucket.max = max;

    cleanup(bucket);

    if (bucket.hits.length >= bucket.max) {
      const retryAfterSec = Math.ceil((bucket.hits[0] + bucket.windowMs - now()) / 1000);
      res.setHeader("Retry-After", String(Math.max(retryAfterSec, 1)));
      return res.status(429).json({
        error: "Rate limit exceeded",
        action,
        retryAfterSec: Math.max(retryAfterSec, 1),
      });
    }

    bucket.hits.push(now());
    buckets.set(key, bucket);
    next();
  };
}
