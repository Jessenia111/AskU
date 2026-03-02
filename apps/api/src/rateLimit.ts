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

function getKey(req: Request, action: string) {
  const userId = req.user?.id ?? "anon";
  const courseId = req.params.courseId ?? "no-course";
  const targetId = (req.body?.targetId as string | undefined) ?? "no-target";
  return `${action}:${userId}:${courseId}:${targetId}`;
}

function cleanup(bucket: Bucket) {
  const cutoff = now() - bucket.windowMs;
  bucket.hits = bucket.hits.filter((t) => t > cutoff);
}

export function rateLimit(action: string, windowMs: number, max: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = getKey(req, action);

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
