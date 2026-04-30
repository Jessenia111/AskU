import type { NextFunction, Request, Response } from "express";
import { prisma } from "./prisma";
import { SESSION_COOKIE, SESSION_INACTIVITY_MS, sha256 } from "./auth";

export async function attachAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return next();

  const tokenHash = sha256(token);

  try {
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, displayMode: true, createdAt: true } } },
    });

    if (!session) return next();

    if (session.expiresAt < new Date()) {
      await prisma.session.deleteMany({ where: { tokenHash } });
      res.clearCookie(SESSION_COOKIE);
      return next();
    }

    req.user = session.user;

    // Sliding inactivity window: every authenticated request pushes the
    // session expiry forward by SESSION_INACTIVITY_MS (1 hour). If no
    // request arrives within that window the session falls into the
    // branch above and is deleted on the next access.
    const newExpiry = new Date(Date.now() + SESSION_INACTIVITY_MS);
    await prisma.session.update({
      where: { tokenHash },
      data: { expiresAt: newExpiry },
    });

    const isProduction = process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true";
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      maxAge: SESSION_INACTIVITY_MS,
    });
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