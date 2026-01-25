import type { Request, Response, NextFunction } from "express";
import { prisma } from "./prisma";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; utSubject: string };
      pseudonym?: { id: string; publicName: string; courseId: string };
    }
  }
}

export async function devAuth(req: Request, _res: Response, next: NextFunction) {
  const utSubject = "dev-user-1";
  const user = await prisma.user.findUnique({ where: { utSubject } });
  if (user) req.user = { id: user.id, utSubject: user.utSubject };
  next();
}

export async function attachCoursePseudonym(req: Request, _res: Response, next: NextFunction) {
  const courseId = req.params.courseId;
  if (!req.user || !courseId) return next();

  const pseudonym = await prisma.pseudonym.findUnique({
    where: { userId_courseId: { userId: req.user.id, courseId } },
  });

  if (pseudonym) req.pseudonym = { id: pseudonym.id, publicName: pseudonym.publicName, courseId };
  next();
}

export function requireModerator(req: Request, res: Response, next: NextFunction) {
  const key = req.header("x-mod-key");
  if (!key || key !== process.env.MOD_KEY) {
    return res.status(403).json({ error: "Moderator access required" });
  }
  next();
}

