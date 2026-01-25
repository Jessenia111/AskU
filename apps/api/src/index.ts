import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import type { Request, Response } from "express";
import { prisma } from "./prisma";
import { z } from "zod";
import { devAuth, attachCoursePseudonym, requireModerator } from "./devAuth";
import { ContentType, ReportStatus, ModActionType } from "@prisma/client";
import { rateLimit } from "./rateLimit";




dotenv.config();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(devAuth);


app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// GET /api/v1/courses
app.get("/api/v1/courses", async (_req: Request, res: Response) => {
  const courses = await prisma.course.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json(courses);
});

// GET /api/v1/courses/:courseId/threads
app.get(
  "/api/v1/courses/:courseId/threads",
  async (req: Request, res: Response) => {
    const { courseId } = req.params;

    const threads = await prisma.thread.findMany({
      where: { courseId, isHidden: false },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { publicName: true } } },
    });

    res.json(
      threads.map((t) => ({
        id: t.id,
        courseId: t.courseId,
        author: { publicName: t.author.publicName },
        title: t.title,
        bodyPreview: t.body.slice(0, 200),
        status: t.status,
        createdAt: t.createdAt,
      }))
    );
  }
);

// GET /api/v1/threads/:threadId
app.get(
  "/api/v1/threads/:threadId",
  async (req: Request, res: Response) => {
    const { threadId } = req.params;

    const thread = await prisma.thread.findFirst({
      where: { id: threadId, isHidden: false },
      include: {
        author: { select: { publicName: true } },
        comments: {
          where: { isHidden: false },
          orderBy: { createdAt: "asc" },
          include: { author: { select: { publicName: true } } },
        },
      },
    });

    if (!thread) {
      return res.status(404).json({ error: "Thread not found" });
    }

    res.json({
      id: thread.id,
      courseId: thread.courseId,
      author: { publicName: thread.author.publicName },
      title: thread.title,
      body: thread.body,
      status: thread.status,
      createdAt: thread.createdAt,
      comments: thread.comments.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt,
        author: { publicName: c.author.publicName },
      })),
    });
  }
);


app.post(
  "/api/v1/courses/:courseId/threads",
  rateLimit("create_thread", 60 * 60 * 1000, 3),
  attachCoursePseudonym,
  async (req: Request, res: Response) => {
    const { courseId } = req.params;

    const bodySchema = z.object({
      title: z.string().min(3).max(200),
      body: z.string().min(1).max(5000),
    });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });

    if (!req.pseudonym) return res.status(403).json({ error: "No pseudonym for this course" });

    const thread = await prisma.thread.create({
      data: {
        courseId,
        authorPseudonymId: req.pseudonym.id,
        title: parsed.data.title,
        body: parsed.data.body,
      },
    });

    res.status(201).json({ id: thread.id });
  }
);

app.post("/api/v1/threads/:threadId/comments",
  rateLimit("create_comment", 60 * 60 * 1000, 10),
  async (req: Request, res: Response) => {
  const { threadId } = req.params;

  const bodySchema = z.object({
    body: z.string().min(1).max(5000),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });

  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const thread = await prisma.thread.findUnique({ where: { id: threadId } });
  if (!thread || thread.isHidden) return res.status(404).json({ error: "Thread not found" });

  // Need pseudonym in the same course as thread
  const pseudonym = await prisma.pseudonym.findUnique({
    where: { userId_courseId: { userId: req.user.id, courseId: thread.courseId } },
  });
  if (!pseudonym) return res.status(403).json({ error: "No pseudonym for this course" });

  const comment = await prisma.comment.create({
    data: {
      threadId,
      authorPseudonymId: pseudonym.id,
      body: parsed.data.body,
    },
  });

  res.status(201).json({ id: comment.id });
});


// POST /api/v1/reports
app.post("/api/v1/reports", 
    rateLimit("create_report", 60 * 60 * 1000, 5),
    async (req: Request, res: Response) => {
  const bodySchema = z.object({
    targetType: z.enum(["THREAD", "COMMENT"]),
    targetId: z.string().uuid(),
    reason: z.string().min(2).max(50),
    details: z.string().max(1000).optional(),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
  }

  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  // Find courseId of the target so we can use correct course pseudonym for reporter
  let courseId: string | null = null;

  if (parsed.data.targetType === "THREAD") {
    const t = await prisma.thread.findUnique({ where: { id: parsed.data.targetId } });
    if (!t || t.isHidden) return res.status(404).json({ error: "Thread not found" });
    courseId = t.courseId;
  } else {
    const c = await prisma.comment.findUnique({
      where: { id: parsed.data.targetId },
      include: { thread: true },
    });
    if (!c || c.isHidden) return res.status(404).json({ error: "Comment not found" });
    courseId = c.thread.courseId;
  }

  const reporterPseudo = await prisma.pseudonym.findUnique({
    where: { userId_courseId: { userId: req.user.id, courseId } },
  });

  if (!reporterPseudo) return res.status(403).json({ error: "No pseudonym for this course" });

  const report = await prisma.report.create({
    data: {
      reporterPseudonymId: reporterPseudo.id,
      targetType: parsed.data.targetType as ContentType,
      targetId: parsed.data.targetId,
      reason: parsed.data.reason,
      details: parsed.data.details,
      status: ReportStatus.OPEN,
    },
  });

  // Minimal audit log
  await prisma.auditLog.create({
    data: {
      actorUserId: req.user.id,
      eventType: "REPORT_CREATED",
      entityType: parsed.data.targetType,
      entityId: report.id,
      metadataJson: { targetId: parsed.data.targetId, reason: parsed.data.reason },
    },
  });

  res.status(201).json({ id: report.id });
});

// GET /api/v1/moderation/reports
app.get("/api/v1/moderation/reports", requireModerator, async (_req: Request, res: Response) => {
  const reports = await prisma.report.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    include: {
      reporter: { select: { publicName: true, courseId: true } },
    },
  });

  res.json(
    reports.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      reporter: { publicName: r.reporter.publicName },
      courseId: r.reporter.courseId,
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      status: r.status,
    }))
  );
});


// POST /api/v1/moderation/actions
app.post("/api/v1/moderation/actions", requireModerator, async (req: Request, res: Response) => {
  const bodySchema = z.object({
    reportId: z.string().uuid().optional(),
    actionType: z.enum(["HIDE", "DELETE"]),
    targetType: z.enum(["THREAD", "COMMENT"]),
    targetId: z.string().uuid(),
    note: z.string().max(1000).optional(),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
  }

  // In dev mode we don't have real moderator user, so we use dev-user-1 as actor
  // (Later: actor is derived from UT SSO + roles)
  const actor = await prisma.user.findUnique({ where: { utSubject: "dev-user-1" } });
  if (!actor) return res.status(500).json({ error: "Dev actor missing" });

  // Apply action to content
  if (parsed.data.targetType === "THREAD") {
    if (parsed.data.actionType === "HIDE") {
      await prisma.thread.update({ where: { id: parsed.data.targetId }, data: { isHidden: true } });
    } else {
      await prisma.thread.delete({ where: { id: parsed.data.targetId } });
    }
  } else {
    if (parsed.data.actionType === "HIDE") {
      await prisma.comment.update({ where: { id: parsed.data.targetId }, data: { isHidden: true } });
    } else {
      await prisma.comment.delete({ where: { id: parsed.data.targetId } });
    }
  }

  const action = await prisma.moderationAction.create({
    data: {
      reportId: parsed.data.reportId,
      moderatorUserId: actor.id,
      actionType: parsed.data.actionType as ModActionType,
      targetType: parsed.data.targetType as ContentType,
      targetId: parsed.data.targetId,
      note: parsed.data.note,
    },
  });

  if (parsed.data.reportId) {
    await prisma.report.update({
      where: { id: parsed.data.reportId },
      data: { status: "RESOLVED" },
    });
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: actor.id,
      eventType: "MOD_ACTION",
      entityType: parsed.data.targetType,
      entityId: parsed.data.targetId,
      metadataJson: { actionType: parsed.data.actionType, reportId: parsed.data.reportId ?? null },
    },
  });

  res.status(201).json({ id: action.id });
});

const port = Number(process.env.PORT ?? 8000);
app.listen(port, "127.0.0.1", () => {
  console.log(`API running on http://127.0.0.1:${port}`);
});

