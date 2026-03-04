import type { Request, Response, NextFunction } from "express";
import { prisma } from "./prisma";

export async function devAuth(req: Request, _res: Response, next: NextFunction) {
  const utSubject = "dev-user-1";
  const user = await prisma.user.findUnique({ where: { utSubject } });
  if (user) req.user = { id: user.id, email: user.email };
  next();
}

export async function attachCoursePseudonym(req: Request, _res: Response, next: NextFunction) {
  const courseId = req.params.courseId;
  if (!req.user || !courseId) return next();

  const pseudonym = await prisma.pseudonym.findUnique({
    where: { userId_courseId: { userId: req.user.id, courseId } },
  });

  if (pseudonym) req.pseudonym = pseudonym;
  next();
}

export function requireModerator(req: Request, res: Response, next: NextFunction) {
  const key = req.header("x-mod-key");
  if (!key || key !== process.env.MOD_KEY) {
    return res.status(403).json({ error: "Moderator access required" });
  }
  next();
}

