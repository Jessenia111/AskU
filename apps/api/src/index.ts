import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "./prisma";
import { z } from "zod";
import { devAuth, attachCoursePseudonym, requireModerator } from "./devAuth";
import { ContentType, ReportStatus, ModActionType } from "@prisma/client";
import { rateLimit } from "./rateLimit";
import cookieParser from "cookie-parser";
import { attachAuth, requireAuth } from "./authMiddleware";
import { generateCode6, isUtEmail, randomToken, SESSION_COOKIE, sha256 } from "./auth";
import { sendVerificationCodeEmail, smtpConfigured } from "./mailer";
import { generatePseudonymName } from "./nameGen";




dotenv.config({ override: true });

/** Wraps an async route handler so unhandled rejections reach Express's error middleware. */
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

async function cleanupExpiredSessions() {
  await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}

cleanupExpiredSessions().catch((e) => {
  console.error("Failed to cleanup expired sessions:", e);
});

const app = express();
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(attachAuth);
if (process.env.DEV_AUTH === "true") {
  app.use(devAuth);
}



app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// POST /api/v1/auth/request
app.post(
  "/api/v1/auth/request",
  rateLimit("auth_request", 60 * 60 * 1000, 10, true),
  asyncHandler(async (req, res) => {  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const email = parsed.data.email.toLowerCase().trim();
  if (!isUtEmail(email)) return res.status(400).json({ error: "Only @ut.ee emails are allowed" });

  const code = generateCode6();
  const codeHash = sha256(code);

  // invalidate old codes
  await prisma.authCode.deleteMany({ where: { email } });

  await prisma.authCode.create({
    data: {
      email,
      codeHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
    },
  });

  if (smtpConfigured()) {
    try {
      await sendVerificationCodeEmail(email, code);
    } catch (err) {
      console.error("[AUTH] Failed to send verification email:", err);
      return res.status(500).json({ error: "Failed to send verification email. Please try again." });
    }
  } else if (process.env.NODE_ENV !== "production") {
    console.log(`[AUTH DEV] Code for ${email}: ${code}`);
  } else {
    console.error("[AUTH] SMTP is not configured in production!");
    return res.status(500).json({ error: "Email service is not configured." });
  }

  res.json({ ok: true });
  }),
);

// POST /api/v1/auth/verify
app.post(
  "/api/v1/auth/verify",
  rateLimit("auth_verify", 60 * 60 * 1000, 30, true),
  asyncHandler(async (req, res) => {  const schema = z.object({
    email: z.string().email(),
    code: z.string().min(6).max(6),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const email = parsed.data.email.toLowerCase().trim();
  const code = parsed.data.code.trim();

  const record = await prisma.authCode.findFirst({ where: { email } });
  if (!record) return res.status(400).json({ error: "Code not found" });
  if (record.expiresAt < new Date()) return res.status(400).json({ error: "Code expired" });

  // attempt limit
  if (record.attempts >= 5) return res.status(429).json({ error: "Too many attempts" });

  const ok = sha256(code) === record.codeHash;
  if (!ok) {
    await prisma.authCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return res.status(400).json({ error: "Invalid code" });
  }

  const now = new Date();

  // dev placeholder for UT subject (until real SSO)
  const utSubject = `email:${email}`;

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      emailVerifiedAt: now,
      utSubject,
    },
    create: {
      email,
      emailVerifiedAt: now,
      utSubject,
    },
  });

  // create session
  const token = randomToken();
  const tokenHash = sha256(token);

  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
    },
  });

  // delete used code
  await prisma.authCode.deleteMany({ where: { email } });

  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true",
    maxAge: 14 * 24 * 60 * 60 * 1000,
  });

  res.json({ ok: true });
  }),
);

// GET /api/v1/me
app.get("/api/v1/me", requireAuth, asyncHandler(async (req, res) => {
  const modRole = await prisma.role.findUnique({ where: { name: "MODERATOR" } });
  const isModerator = modRole
    ? !!(await prisma.userRole.findUnique({
        where: { userId_roleId: { userId: req.user!.id, roleId: modRole.id } },
      }))
    : false;

  res.json({ id: req.user!.id, email: req.user!.email, isModerator });
}));

// POST /api/v1/auth/logout
app.post("/api/v1/auth/logout", requireAuth, asyncHandler(async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) {
    const tokenHash = sha256(token);
    await prisma.session.deleteMany({ where: { tokenHash } });
  }
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
}));

// GET /api/v1/courses/:courseId/my-pseudonym — returns current user's pseudonym for a course
app.get("/api/v1/courses/:courseId/my-pseudonym", requireAuth, asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const pseudonym = await prisma.pseudonym.findUnique({
    where: { userId_courseId: { userId: req.user!.id, courseId } },
  });
  res.json({ publicName: pseudonym?.publicName ?? null });
}));

// GET /api/v1/me/pseudonyms — all pseudonyms for the logged-in user
app.get("/api/v1/me/pseudonyms", requireAuth, asyncHandler(async (req, res) => {
  const pseudonyms = await prisma.pseudonym.findMany({
    where: { userId: req.user!.id },
    include: { course: { select: { id: true, code: true, title: true, semester: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(
    pseudonyms.map((p) => ({
      courseId: p.courseId,
      courseCode: p.course.code,
      courseTitle: p.course.title,
      courseSemester: p.course.semester,
      publicName: p.publicName,
    }))
  );
}));

// GET /api/v1/courses
app.get("/api/v1/courses", asyncHandler(async (_req, res) => {
  const courses = await prisma.course.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json(courses);
}));

// GET /api/v1/courses/:courseId/threads
app.get(
  "/api/v1/courses/:courseId/threads",
  asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    const skip = Math.max(0, Number(req.query.skip ?? 0));
    const take = Math.min(50, Math.max(1, Number(req.query.take ?? 20)));

    const [threads, total] = await Promise.all([
      prisma.thread.findMany({
        where: { courseId, isHidden: false },
        orderBy: { createdAt: "desc" },
        include: { author: { select: { publicName: true } } },
        skip,
        take,
      }),
      prisma.thread.count({ where: { courseId, isHidden: false } }),
    ]);

    res.json({
      items: threads.map((t) => ({
        id: t.id,
        courseId: t.courseId,
        author: { publicName: t.author.publicName },
        title: t.title,
        bodyPreview: t.body.slice(0, 200),
        status: t.status,
        createdAt: t.createdAt,
      })),
      total,
      skip,
      take,
    });
  }),
);

// GET /api/v1/threads/:threadId
app.get("/api/v1/threads/:threadId", asyncHandler(async (req, res) => {
  const { threadId } = req.params;

  const thread = await prisma.thread.findFirst({
    where: { id: threadId, isHidden: false },
    include: {
      author: { select: { publicName: true, userId: true } },
      comments: {
        where: { isHidden: false },
        orderBy: { createdAt: "asc" },
        include: { author: { select: { publicName: true, userId: true } } },
      },
    },
  });

  if (!thread) {
    return res.status(404).json({ error: "Thread not found" });
  }

  const myUserId = req.user?.id ?? null;
  const threadIsMine = myUserId ? thread.author.userId === myUserId : false;

  res.json({
    id: thread.id,
    courseId: thread.courseId,
    author: { publicName: thread.author.publicName },
    isMine: threadIsMine,
    title: thread.title,
    body: thread.body,
    status: thread.status,
    createdAt: thread.createdAt,
    comments: thread.comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      author: { publicName: c.author.publicName },
      isMine: myUserId ? c.author.userId === myUserId : false,
    })),
  });
}));

app.post(
  "/api/v1/courses/:courseId/threads",
  requireAuth,
  rateLimit("create_thread", 60 * 60 * 1000, 3),
  attachCoursePseudonym,
  asyncHandler(async (req, res) => {
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
  }),
);

app.post("/api/v1/threads/:threadId/comments",
  requireAuth,
  rateLimit("create_comment", 60 * 60 * 1000, 10),
  asyncHandler(async (req, res) => {
  const { threadId } = req.params;

  const bodySchema = z.object({
    body: z.string().min(1).max(5000),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });

  const thread = await prisma.thread.findUnique({ where: { id: threadId } });
  if (!thread || thread.isHidden) return res.status(404).json({ error: "Thread not found" });

  // Need pseudonym in the same course as thread — auto-create if missing
  let pseudonym = await prisma.pseudonym.findUnique({
    where: { userId_courseId: { userId: req.user!.id, courseId: thread.courseId } },
  });

  if (!pseudonym) {
    let attempts = 0;
    while (!pseudonym && attempts < 5) {
      try {
        pseudonym = await prisma.pseudonym.create({
          data: { userId: req.user!.id, courseId: thread.courseId, publicName: generatePseudonymName() },
        });
      } catch {
        attempts++;
      }
    }
    if (!pseudonym) return res.status(500).json({ error: "Could not generate pseudonym, please try again" });
  }

  const comment = await prisma.comment.create({
    data: {
      threadId,
      authorPseudonymId: pseudonym.id,
      body: parsed.data.body,
    },
  });

  res.status(201).json({ id: comment.id });
  }),
);

// POST /api/v1/reports
app.post(
  "/api/v1/reports",
  requireAuth,
  rateLimit("create_report", 60 * 60 * 1000, process.env.NODE_ENV === "production" ? 5 : 100),
  asyncHandler(async (req, res) => {
    const bodySchema = z.object({
      targetType: z.enum(["THREAD", "COMMENT"]),
      targetId: z.string().uuid(),
      reason: z.enum(["SPAM", "ABUSE"]),
      details: z.string().max(1000).optional(),
    });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    }

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
      where: { userId_courseId: { userId: req.user!.id, courseId } },
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

    await prisma.auditLog.create({
      data: {
        actorUserId: req.user!.id,
        eventType: "REPORT_CREATED",
        entityType: parsed.data.targetType,
        entityId: report.id,
        metadataJson: { targetId: parsed.data.targetId, reason: parsed.data.reason },
      },
    });

    res.status(201).json({ id: report.id });
  }),
);

// GET /api/v1/moderation/reports
app.get("/api/v1/moderation/reports", requireAuth, requireModerator, asyncHandler(async (_req, res) => {
  const reports = await prisma.report.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    include: {
      reporter: { select: { publicName: true, courseId: true } },
    },
  });

  // Batch-fetch content for all reported threads and comments
  const threadIds = reports.filter((r) => r.targetType === "THREAD").map((r) => r.targetId);
  const commentIds = reports.filter((r) => r.targetType === "COMMENT").map((r) => r.targetId);
  const courseIds = [...new Set(reports.map((r) => r.reporter.courseId))];

  const [threads, comments, courses] = await Promise.all([
    prisma.thread.findMany({ where: { id: { in: threadIds } }, select: { id: true, title: true, body: true } }),
    prisma.comment.findMany({ where: { id: { in: commentIds } }, select: { id: true, body: true } }),
    prisma.course.findMany({ where: { id: { in: courseIds } }, select: { id: true, code: true, title: true } }),
  ]);

  const threadMap = new Map(threads.map((t) => [t.id, t]));
  const commentMap = new Map(comments.map((c) => [c.id, c]));
  const courseMap = new Map(courses.map((c) => [c.id, c]));

  res.json(
    reports.map((r) => {
      const course = courseMap.get(r.reporter.courseId);
      let contentTitle: string | null = null;
      let contentPreview: string | null = null;

      if (r.targetType === "THREAD") {
        const t = threadMap.get(r.targetId);
        contentTitle = t?.title ?? "[deleted]";
        contentPreview = t ? t.body.slice(0, 300) : null;
      } else {
        const c = commentMap.get(r.targetId);
        contentPreview = c ? c.body.slice(0, 300) : "[deleted]";
      }

      return {
        id: r.id,
        createdAt: r.createdAt,
        reporter: { publicName: r.reporter.publicName },
        course: course ? { id: course.id, code: course.code, title: course.title } : null,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason,
        status: r.status,
        contentTitle,
        contentPreview,
      };
    })
  );
}));

// POST /api/v1/moderation/actions
app.post("/api/v1/moderation/actions", requireAuth, requireModerator, asyncHandler(async (req, res) => {
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

  const actorId = req.user!.id;

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
      moderatorUserId: actorId,
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
      actorUserId: actorId,
      eventType: "MOD_ACTION",
      entityType: parsed.data.targetType,
      entityId: parsed.data.targetId,
      metadataJson: { actionType: parsed.data.actionType, reportId: parsed.data.reportId ?? null },
    },
  });

  res.status(201).json({ id: action.id });
}));

// POST /api/v1/moderation/dismiss — close a report without taking action on content
app.post("/api/v1/moderation/dismiss", requireAuth, requireModerator, asyncHandler(async (req, res) => {
  const bodySchema = z.object({ reportId: z.string().uuid() });
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const report = await prisma.report.findUnique({ where: { id: parsed.data.reportId } });
  if (!report) return res.status(404).json({ error: "Report not found" });

  await prisma.report.update({
    where: { id: parsed.data.reportId },
    data: { status: "REVIEWED" },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: req.user!.id,
      eventType: "MOD_DISMISS",
      entityType: report.targetType,
      entityId: report.targetId,
      metadataJson: { reportId: parsed.data.reportId },
    },
  });

  res.json({ ok: true });
}));

// DELETE /api/v1/threads/:threadId (author can hide own thread)
app.delete("/api/v1/threads/:threadId", requireAuth, asyncHandler(async (req, res) => {
  const { threadId } = req.params;

  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
    include: { author: { select: { userId: true } } },
  });

  if (!thread || thread.isHidden) return res.status(404).json({ error: "Thread not found" });
  if (thread.author.userId !== req.user!.id) return res.status(403).json({ error: "Not allowed" });

  await prisma.thread.update({
    where: { id: threadId },
    data: { isHidden: true },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: req.user!.id,
      eventType: "THREAD_HIDDEN_BY_AUTHOR",
      entityType: "THREAD",
      entityId: threadId,
      metadataJson: {},
    },
  });

  return res.status(204).send();
}));

// DELETE /api/v1/comments/:commentId (author can hide own comment)
app.delete("/api/v1/comments/:commentId", requireAuth, asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { author: { select: { userId: true } } },
  });

  if (!comment || comment.isHidden) return res.status(404).json({ error: "Comment not found" });
  if (comment.author.userId !== req.user!.id) return res.status(403).json({ error: "Not allowed" });

  await prisma.comment.update({
    where: { id: commentId },
    data: { isHidden: true },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: req.user!.id,
      eventType: "COMMENT_HIDDEN_BY_AUTHOR",
      entityType: "COMMENT",
      entityId: commentId,
      metadataJson: {},
    },
  });

  return res.status(204).send();
}));

// Global error handler — catches any error passed via next(err) or thrown in asyncHandler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[UNHANDLED ERROR]", err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error" });
  }
});

const port = Number(process.env.PORT ?? 8000);
app.listen(port, "localhost", () => {
  console.log(`API running on http://localhost:${port}`);
});

