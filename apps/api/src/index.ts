import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "./prisma";
import { z } from "zod";
import { devAuth, attachCoursePseudonym, requireModerator } from "./devAuth";
import { ContentType, ReportStatus, ModActionType } from "@prisma/client";
import { rateLimit, newAccountRateLimit } from "./rateLimit";
import cookieParser from "cookie-parser";
import { attachAuth, requireAuth } from "./authMiddleware";
import { generateCode6, isUtEmail, randomToken, SESSION_COOKIE, sha256 } from "./auth";
import { sendVerificationCodeEmail, smtpConfigured } from "./mailer";
import { getOrRotatePseudonym, updateAllPseudonymsForUser, regeneratePseudonym, findActivePseudonym } from "./pseudonym";




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
app.use(express.json({ limit: "5mb" }));
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
  const domain = (process.env.ALLOWED_EMAIL_DOMAIN ?? "ut.ee").trim();
  if (!isUtEmail(email)) {
    const msg = domain ? `Only @${domain} emails are allowed` : "Invalid email address";
    return res.status(400).json({ error: msg });
  }

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
      // In dev: still print code so testing can continue even if email fails
      if (process.env.NODE_ENV !== "production") {
        console.log(`[AUTH DEV] Email failed but code for ${email}: ${code}`);
      } else {
        return res.status(500).json({ error: "Failed to send verification email. Please try again." });
      }
    }
  } else if (process.env.NODE_ENV !== "production") {
    console.log(`[AUTH DEV] Code for ${email}: ${code}`);
  } else {
    console.error("[AUTH] SMTP is not configured in production!");
    return res.status(500).json({ error: "Email service is not configured." });
  }

  // Always log code in dev for easy testing with multiple users
  if (process.env.NODE_ENV !== "production") {
    console.log(`[AUTH DEV] ✉️  ${email} → code: ${code}`);
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

  // Auto-grant MODERATOR role if email matches MODERATOR_EMAIL env var
  const moderatorEmail = process.env.MODERATOR_EMAIL?.toLowerCase().trim();
  if (moderatorEmail && email === moderatorEmail) {
    const modRole = await prisma.role.findUnique({ where: { name: "MODERATOR" } });
    if (modRole) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: modRole.id } },
        update: {},
        create: { userId: user.id, roleId: modRole.id },
      });
    }
  }

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

  const isProduction = process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true";
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
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

  res.json({
    id: req.user!.id,
    email: req.user!.email,
    isModerator,
    displayMode: req.user!.displayMode ?? null,
  });
}));

// PATCH /api/v1/me/display-mode — set anonymous vs real-name preference
app.patch("/api/v1/me/display-mode", requireAuth, asyncHandler(async (req, res) => {
  const schema = z.object({ displayMode: z.enum(["ANONYMOUS", "REAL_NAME"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid displayMode" });

  await prisma.user.update({
    where: { id: req.user!.id },
    data: { displayMode: parsed.data.displayMode },
  });

  // Update all existing pseudonyms immediately so every course reflects the change at once
  await updateAllPseudonymsForUser(req.user!.id, req.user!.email, parsed.data.displayMode);

  res.json({ ok: true, displayMode: parsed.data.displayMode });
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

// GET /api/v1/courses/:courseId/my-pseudonym — returns (or auto-creates/rotates) pseudonym for a course
app.get("/api/v1/courses/:courseId/my-pseudonym", requireAuth, asyncHandler(async (req, res) => {
  const { courseId } = req.params;

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return res.status(404).json({ error: "Course not found" });

  const pseudonym = await getOrRotatePseudonym(
    req.user!.id,
    courseId,
    req.user!.email,
    req.user!.displayMode ?? null,
  );

  res.json({ publicName: pseudonym?.publicName ?? null });
}));

// POST /api/v1/courses/:courseId/my-pseudonym/regenerate — manually regenerate anonymous pseudonym
app.post("/api/v1/courses/:courseId/my-pseudonym/regenerate", requireAuth, asyncHandler(async (req, res) => {
  const { courseId } = req.params;

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return res.status(404).json({ error: "Course not found" });

  if (req.user!.displayMode === "REAL_NAME") {
    return res.status(400).json({ error: "Cannot regenerate pseudonym while using real name mode." });
  }

  const existing = await findActivePseudonym(req.user!.id, courseId);
  // Archive old pseudonym and create a new one — posts written under old name keep it
  const fresh = await regeneratePseudonym(req.user!.id, courseId, existing?.publicName);

  res.json({ publicName: fresh.publicName });
}));

// GET /api/v1/me/pseudonyms — active pseudonyms for the logged-in user
app.get("/api/v1/me/pseudonyms", requireAuth, asyncHandler(async (req, res) => {
  const pseudonyms = await prisma.pseudonym.findMany({
    where: { userId: req.user!.id, isActive: true },
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

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return res.status(404).json({ error: "Course not found" });

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
      courseTitle: course.title,
      items: threads.map((t) => ({
        id: t.id,
        courseId: t.courseId,
        author: { pseudonymId: t.authorPseudonymId, publicName: t.author.publicName },
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
        include: {
          author: { select: { publicName: true, userId: true } },
          reactions: { select: { userId: true, type: true } },
        },
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
    author: { pseudonymId: thread.authorPseudonymId, publicName: thread.author.publicName },
    isMine: threadIsMine,
    title: thread.title,
    body: thread.body,
    imageUrl: thread.imageUrl ?? null,
    status: thread.status,
    createdAt: thread.createdAt,
    comments: thread.comments.map((c) => {
      const likeCount = c.reactions.filter((r) => r.type === "LIKE").length;
      const iLiked = myUserId ? c.reactions.some((r) => r.userId === myUserId && r.type === "LIKE") : false;
      return {
        id: c.id,
        body: c.body,
        imageUrl: c.imageUrl ?? null,
        createdAt: c.createdAt,
        author: { pseudonymId: c.authorPseudonymId, publicName: c.author.publicName },
        isMine: myUserId ? c.author.userId === myUserId : false,
        likeCount,
        iLiked,
      };
    }),
  });
}));

app.post(
  "/api/v1/courses/:courseId/threads",
  requireAuth,
  newAccountRateLimit("create_thread", 60 * 60 * 1000, 3, 1),
  attachCoursePseudonym,
  asyncHandler(async (req, res) => {
    const { courseId } = req.params;

    const bodySchema = z.object({
      title: z.string().min(3).max(200),
      body: z.string().min(1).max(5000),
      imageUrl: z.string().max(5 * 1024 * 1024).optional().nullable(),
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
        imageUrl: parsed.data.imageUrl ?? null,
      },
    });

    res.status(201).json({ id: thread.id });
  }),
);

app.post("/api/v1/threads/:threadId/comments",
  requireAuth,
  newAccountRateLimit("create_comment", 60 * 60 * 1000, 10, 5),
  asyncHandler(async (req, res) => {
  const { threadId } = req.params;

  const bodySchema = z.object({
    body: z.string().min(1).max(5000),
    imageUrl: z.string().max(5 * 1024 * 1024).optional().nullable(),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });

  const thread = await prisma.thread.findUnique({ where: { id: threadId } });
  if (!thread || thread.isHidden) return res.status(404).json({ error: "Thread not found" });

  const pseudonym = await getOrRotatePseudonym(
    req.user!.id,
    thread.courseId,
    req.user!.email,
    req.user!.displayMode ?? null,
  );
  if (!pseudonym) return res.status(500).json({ error: "Could not generate pseudonym, please try again" });

  const comment = await prisma.comment.create({
    data: {
      threadId,
      authorPseudonymId: pseudonym.id,
      body: parsed.data.body,
      imageUrl: parsed.data.imageUrl ?? null,
    },
  });

  res.status(201).json({ id: comment.id });
  }),
);

// POST /api/v1/comments/:commentId/reactions — toggle a reaction (like)
app.post("/api/v1/comments/:commentId/reactions", requireAuth, asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const schema = z.object({ type: z.string().min(1).max(20).default("LIKE") });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });
  const { type } = parsed.data;

  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment || comment.isHidden) return res.status(404).json({ error: "Comment not found" });

  const existing = await prisma.reaction.findUnique({
    where: { userId_commentId_type: { userId: req.user!.id, commentId, type } },
  });

  if (existing) {
    await prisma.reaction.delete({ where: { id: existing.id } });
    const count = await prisma.reaction.count({ where: { commentId, type } });
    return res.json({ liked: false, count });
  } else {
    await prisma.reaction.create({ data: { userId: req.user!.id, commentId, type } });
    const count = await prisma.reaction.count({ where: { commentId, type } });
    return res.json({ liked: true, count });
  }
}));

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

    // Auto-create pseudonym if needed — reporters shouldn't need to visit the course page first
    let reporterPseudo = await findActivePseudonym(req.user!.id, courseId);
    if (!reporterPseudo) {
      reporterPseudo = await getOrRotatePseudonym(
        req.user!.id, courseId, req.user!.email, req.user!.displayMode ?? null,
      );
    }
    if (!reporterPseudo) return res.status(500).json({ error: "Could not create pseudonym" });

    // Prevent duplicate reports from the same pseudonym on the same target
    const existing = await prisma.report.findFirst({
      where: {
        reporterPseudonymId: reporterPseudo.id,
        targetId: parsed.data.targetId,
        status: ReportStatus.OPEN,
      },
    });
    if (existing) return res.status(409).json({ error: "You have already reported this." });

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

    // Auto-hide if 3+ distinct users in the same course have reported this content
    const openReportCount = await prisma.report.count({
      where: { targetId: parsed.data.targetId, status: ReportStatus.OPEN },
    });
    if (openReportCount >= 3) {
      if (parsed.data.targetType === "THREAD") {
        await prisma.thread.updateMany({
          where: { id: parsed.data.targetId, isHidden: false },
          data: { isHidden: true },
        });
      } else {
        await prisma.comment.updateMany({
          where: { id: parsed.data.targetId, isHidden: false },
          data: { isHidden: true },
        });
      }
    }

    res.status(201).json({ id: report.id });
  }),
);

// GET /api/v1/moderation/reports
app.get("/api/v1/moderation/reports", requireAuth, requireModerator, asyncHandler(async (_req, res) => {
  const reports = await prisma.report.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    include: {
      reporter: {
        select: {
          id: true,
          publicName: true,
          courseId: true,
          user: { select: { email: true } },
        },
      },
    },
  });

  // Batch-fetch content for all reported threads and comments (include author info for email)
  const threadIds = reports.filter((r) => r.targetType === "THREAD").map((r) => r.targetId);
  const commentIds = reports.filter((r) => r.targetType === "COMMENT").map((r) => r.targetId);
  const courseIds = [...new Set(reports.map((r) => r.reporter.courseId))];

  const [threads, comments, courses] = await Promise.all([
    prisma.thread.findMany({
      where: { id: { in: threadIds } },
      select: {
        id: true, title: true, body: true,
        author: { select: { publicName: true, user: { select: { email: true } } } },
      },
    }),
    prisma.comment.findMany({
      where: { id: { in: commentIds } },
      select: {
        id: true, body: true,
        author: { select: { publicName: true, user: { select: { email: true } } } },
      },
    }),
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
      let contentAuthorEmail: string | null = null;
      let contentAuthorName: string | null = null;

      if (r.targetType === "THREAD") {
        const t = threadMap.get(r.targetId);
        contentTitle = t?.title ?? "[deleted]";
        contentPreview = t ? t.body.slice(0, 300) : null;
        contentAuthorEmail = t?.author?.user?.email ?? null;
        contentAuthorName = t?.author?.publicName ?? null;
      } else {
        const c = commentMap.get(r.targetId);
        contentPreview = c ? c.body.slice(0, 300) : "[deleted]";
        contentAuthorEmail = c?.author?.user?.email ?? null;
        contentAuthorName = c?.author?.publicName ?? null;
      }

      return {
        id: r.id,
        createdAt: r.createdAt,
        reporter: { pseudonymId: r.reporter.id, publicName: r.reporter.publicName },
        course: course ? { id: course.id, code: course.code, title: course.title } : null,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason,
        status: r.status,
        contentTitle,
        contentPreview,
        contentAuthorEmail,
        contentAuthorName,
      };
    })
  );
}));

// ── Moderator: Course management ─────────────────────────────────────────────

// GET /api/v1/moderation/courses
app.get("/api/v1/moderation/courses", requireAuth, requireModerator, asyncHandler(async (_req, res) => {
  const courses = await prisma.course.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { pseudonyms: { where: { isActive: true } } } } },
  });
  res.json(courses.map((c) => ({ ...c, memberCount: c._count.pseudonyms })));
}));

// GET /api/v1/moderation/courses/:courseId/members
app.get("/api/v1/moderation/courses/:courseId/members", requireAuth, requireModerator, asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  // Use Pseudonym as source of truth — enrollment records may not exist
  const pseudonyms = await prisma.pseudonym.findMany({
    where: { courseId, isActive: true },
    include: {
      user: { select: { id: true, email: true, displayMode: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  res.json(pseudonyms.map((p) => ({
    userId: p.user.id,
    email: p.user.email,
    displayMode: p.user.displayMode,
    pseudonym: p.publicName,
  })));
}));

// POST /api/v1/moderation/courses — create a course
app.post("/api/v1/moderation/courses", requireAuth, requireModerator, asyncHandler(async (req, res) => {
  const schema = z.object({
    code: z.string().min(1).max(50),
    title: z.string().min(1).max(200),
    semester: z.string().min(1).max(50),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });

  const existing = await prisma.course.findUnique({
    where: { code_semester: { code: parsed.data.code, semester: parsed.data.semester } },
  });
  if (existing) return res.status(409).json({ error: "Course with this code and semester already exists" });

  const course = await prisma.course.create({ data: parsed.data });

  await prisma.auditLog.create({
    data: {
      actorUserId: req.user!.id,
      eventType: "COURSE_CREATED",
      entityType: "COURSE",
      entityId: course.id,
      metadataJson: { code: course.code, title: course.title, semester: course.semester },
    },
  });

  res.status(201).json(course);
}));

// DELETE /api/v1/moderation/courses/:courseId — delete a course and all its content
app.delete("/api/v1/moderation/courses/:courseId", requireAuth, requireModerator, asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return res.status(404).json({ error: "Course not found" });

  await prisma.course.delete({ where: { id: courseId } });

  await prisma.auditLog.create({
    data: {
      actorUserId: req.user!.id,
      eventType: "COURSE_DELETED",
      entityType: "COURSE",
      entityId: courseId,
      metadataJson: { code: course.code, title: course.title },
    },
  });

  res.status(204).send();
}));

// ── Moderator: User management ────────────────────────────────────────────────

// GET /api/v1/moderation/users
app.get("/api/v1/moderation/users", requireAuth, requireModerator, asyncHandler(async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      createdAt: true,
      displayMode: true,
      roles: { select: { role: { select: { name: true } } } },
    },
  });
  res.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      createdAt: u.createdAt,
      displayMode: u.displayMode,
      isModerator: u.roles.some((r) => r.role.name === "MODERATOR"),
    }))
  );
}));

// DELETE /api/v1/moderation/users/:userId — delete a user account
app.delete("/api/v1/moderation/users/:userId", requireAuth, requireModerator, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (userId === req.user!.id) return res.status(400).json({ error: "Cannot delete your own account" });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "User not found" });

  await prisma.user.delete({ where: { id: userId } });

  await prisma.auditLog.create({
    data: {
      actorUserId: req.user!.id,
      eventType: "USER_DELETED",
      entityType: "USER",
      entityId: userId,
      metadataJson: { email: user.email },
    },
  });

  res.status(204).send();
}));

// GET /api/v1/moderation/users/:userId/courses
app.get("/api/v1/moderation/users/:userId/courses", requireAuth, requireModerator, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  // Use active pseudonyms as source of truth — enrollment records may not exist
  const pseudonyms = await prisma.pseudonym.findMany({
    where: { userId, isActive: true },
    include: {
      course: { select: { id: true, code: true, title: true, semester: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  res.json(pseudonyms.map((p) => ({
    courseId: p.course.id,
    code: p.course.code,
    title: p.course.title,
    semester: p.course.semester,
    pseudonym: p.publicName,
  })));
}));

// POST /api/v1/moderation/users/:userId/grant-moderator
app.post("/api/v1/moderation/users/:userId/grant-moderator", requireAuth, requireModerator, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "User not found" });

  let modRole = await prisma.role.findUnique({ where: { name: "MODERATOR" } });
  if (!modRole) modRole = await prisma.role.create({ data: { name: "MODERATOR" } });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId, roleId: modRole.id } },
    update: {},
    create: { userId, roleId: modRole.id },
  });

  res.json({ ok: true });
}));

// DELETE /api/v1/moderation/users/:userId/revoke-moderator
app.delete("/api/v1/moderation/users/:userId/revoke-moderator", requireAuth, requireModerator, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const modRole = await prisma.role.findUnique({ where: { name: "MODERATOR" } });
  if (!modRole) return res.json({ ok: true });

  await prisma.userRole.deleteMany({
    where: { userId, roleId: modRole.id },
  });

  res.json({ ok: true });
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

// GET /api/v1/pseudonyms/:pseudonymId/identity — moderator only: reveal real email behind a pseudonym
app.get("/api/v1/pseudonyms/:pseudonymId/identity", requireAuth, requireModerator, asyncHandler(async (req, res) => {
  const { pseudonymId } = req.params;
  const pseudonym = await prisma.pseudonym.findUnique({
    where: { id: pseudonymId },
    include: { user: { select: { email: true } } },
  });
  if (!pseudonym) return res.status(404).json({ error: "Pseudonym not found" });
  res.json({ pseudonymId, publicName: pseudonym.publicName, email: pseudonym.user.email });
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

// POST /api/v1/dev/make-moderator — dev only: grant moderator role to a specific allowed email
app.post("/api/v1/dev/make-moderator", requireAuth, asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Not available in production" });
  }

  const allowedEmail = process.env.MODERATOR_EMAIL?.toLowerCase().trim();
  if (!allowedEmail) {
    return res.status(403).json({ error: "MODERATOR_EMAIL is not configured in .env" });
  }

  if (req.user!.email.toLowerCase() !== allowedEmail) {
    return res.status(403).json({ error: "You don't have permission to do this." });
  }

  let modRole = await prisma.role.findUnique({ where: { name: "MODERATOR" } });
  if (!modRole) {
    modRole = await prisma.role.create({ data: { name: "MODERATOR" } });
  }

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: req.user!.id, roleId: modRole.id } },
    update: {},
    create: { userId: req.user!.id, roleId: modRole.id },
  });

  res.json({ ok: true, message: "Moderator role granted" });
}));

// GET /api/v1/moderation/audit-log
app.get("/api/v1/moderation/audit-log", requireAuth, requireModerator, asyncHandler(async (_req, res) => {
  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { email: true } } },
  });
  res.json(
    entries.map((e) => ({
      id: e.id,
      createdAt: e.createdAt,
      actorEmail: e.actor.email,
      eventType: e.eventType,
      entityType: e.entityType,
      entityId: e.entityId,
      metadata: e.metadataJson,
    }))
  );
}));

// Global error handler — catches any error passed via next(err) or thrown in asyncHandler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[UNHANDLED ERROR]", err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error" });
  }
});

const port = Number(process.env.PORT ?? 8000);
// Use 0.0.0.0 to be reachable from LAN / other devices (needed for local testing with peers)
const host = process.env.API_HOST ?? (process.env.NODE_ENV === "production" ? "0.0.0.0" : "0.0.0.0");
app.listen(port, host, () => {
  console.log(`API running on http://${host}:${port}`);
});

