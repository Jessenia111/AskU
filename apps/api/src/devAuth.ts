import type { Request, Response, NextFunction } from "express";
import { prisma } from "./prisma";
import { getOrRotatePseudonym } from "./pseudonym";

export async function devAuth(req: Request, _res: Response, next: NextFunction) {
  // Only inject dev user if there is no real session already
  if (req.user) return next();
  const utSubject = "dev-user-1";
  const user = await prisma.user.findUnique({ where: { utSubject } });
  if (user) req.user = { id: user.id, email: user.email, displayMode: user.displayMode, createdAt: user.createdAt };
  next();
}

export async function attachCoursePseudonym(req: Request, _res: Response, next: NextFunction) {
  const courseId = req.params.courseId;
  if (!req.user || !courseId) return next();

  const pseudonym = await getOrRotatePseudonym(
    req.user.id,
    courseId,
    req.user.email,
    req.user.displayMode ?? null,
  );

  if (pseudonym) req.pseudonym = pseudonym;
  next();
}

export async function requireModerator(req: Request, res: Response, next: NextFunction) {
  // Primary: check MODERATOR role in DB
  if (req.user) {
    const modRole = await prisma.role.findUnique({ where: { name: "MODERATOR" } });
    if (modRole) {
      const userRole = await prisma.userRole.findUnique({
        where: { userId_roleId: { userId: req.user.id, roleId: modRole.id } },
      });
      if (userRole) return next();
    }
  }

  // Fallback: static MOD_KEY header (dev/emergency access — non-production only)
  if (process.env.NODE_ENV !== "production") {
    const key = req.header("x-mod-key");
    if (key && key === process.env.MOD_KEY) return next();
  }

  return res.status(403).json({ error: "Moderator access required" });
}

