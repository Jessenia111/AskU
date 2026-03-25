import type { NextFunction, Request, Response } from "express";
import { prisma } from "./prisma";
import { SESSION_COOKIE, sha256 } from "./auth";

export async function attachAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return next();

  const tokenHash = sha256(token);

  try {
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!session) return next();

    if (session.expiresAt < new Date()) {
      await prisma.session.deleteMany({ where: { tokenHash } });
      res.clearCookie(SESSION_COOKIE);
      return next();
    }

    req.user = session.user;
  } catch (err) {
    console.error("[AUTH] Failed to load session from DB:", err);
    // Continue unauthenticated — don't crash the request
  }

  return next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  return next();
}