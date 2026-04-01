import { prisma } from "./prisma";
import { generatePseudonymName, deriveRealName } from "./nameGen";

/**
 * Returns true if the given publicName was generated from the user's real email
 * rather than a random anonymous name.
 * Handles both "Jessenia Tsenkman" (two parts) and single-word names like "John".
 */
function looksLikeRealName(publicName: string, email: string): boolean {
  const base = deriveRealName(email);
  return publicName === base || publicName.startsWith(base + " ");
}

/** How long anonymous pseudonyms live before rotating. */
const PSEUDONYM_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Find the currently active pseudonym for a user in a course (or null). */
export async function findActivePseudonym(userId: string, courseId: string) {
  return prisma.pseudonym.findFirst({
    where: { userId, courseId, isActive: true },
  });
}

/** Pick a random name not already used by any ACTIVE pseudonym in this course. */
async function pickAnonymousName(courseId: string, excludeName?: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const name = generatePseudonymName();
    if (name === excludeName) continue;
    const taken = await prisma.pseudonym.findFirst({
      where: { courseId, publicName: name, isActive: true },
    });
    if (!taken) return name;
  }
  return generatePseudonymName();
}

/** Pick a real-name pseudonym not already used by any ACTIVE pseudonym in this course. */
async function pickRealName(email: string, courseId: string, excludeId?: string): Promise<string> {
  const base = deriveRealName(email);

  const isTaken = async (name: string) => {
    const found = await prisma.pseudonym.findFirst({
      where: { courseId, publicName: name, isActive: true },
    });
    return !!found && found.id !== excludeId;
  };

  if (!(await isTaken(base))) return base;
  for (let i = 2; i <= 20; i++) {
    const name = `${base} ${i}`;
    if (!(await isTaken(name))) return name;
  }
  return `${base} ${Date.now()}`;
}

/**
 * Archive the current active pseudonym (mark isActive = false) and
 * create a brand-new one with the given name.
 *
 * Old threads/comments still reference the archived pseudonymId → they
 * keep showing the old name forever. New posts will use the new pseudonymId.
 */
async function archiveAndCreate(
  userId: string,
  courseId: string,
  newName: string,
  expiresAt: Date | null,
) {
  // Deactivate all currently active pseudonyms for this user/course
  await prisma.pseudonym.updateMany({
    where: { userId, courseId, isActive: true },
    data: { isActive: false },
  });

  return prisma.pseudonym.create({
    data: { userId, courseId, publicName: newName, isActive: true, expiresAt },
  });
}

/**
 * Get (or auto-create / rotate) the active pseudonym for a user in a course.
 *
 * Rules:
 *  - No active pseudonym → create one.
 *  - REAL_NAME: name must match derived name; if not, archive + create new.
 *  - ANONYMOUS: if name looks like a real name (has space) → archive + create random.
 *  - ANONYMOUS: if expiresAt is null → start the timer (keep name, no archive).
 *  - ANONYMOUS: if expired → archive + create new random name.
 *
 * Historical posts always keep their original pseudonymId and publicName.
 */
export async function getOrRotatePseudonym(
  userId: string,
  courseId: string,
  email: string,
  displayMode: string | null,
) {
  const now = new Date();
  const isRealName = displayMode === "REAL_NAME";

  let pseudonym = await findActivePseudonym(userId, courseId);

  if (!pseudonym) {
    const name = isRealName
      ? await pickRealName(email, courseId)
      : await pickAnonymousName(courseId);
    const expiresAt = isRealName ? null : new Date(now.getTime() + PSEUDONYM_TTL_MS);
    pseudonym = await prisma.pseudonym.create({
      data: { userId, courseId, publicName: name, isActive: true, expiresAt },
    });
    return pseudonym;
  }

  if (isRealName) {
    const expectedName = await pickRealName(email, courseId, pseudonym.id);
    if (pseudonym.publicName !== expectedName || pseudonym.expiresAt !== null) {
      // Archive old, create new real-name pseudonym
      pseudonym = await archiveAndCreate(userId, courseId, expectedName, null);
    }
    return pseudonym;
  }

  // Anonymous path
  if (looksLikeRealName(pseudonym.publicName, email)) {
    // Mode switched from real name → anonymous: archive old, create random
    const newName = await pickAnonymousName(courseId);
    pseudonym = await archiveAndCreate(
      userId, courseId, newName,
      new Date(now.getTime() + PSEUDONYM_TTL_MS),
    );
    return pseudonym;
  }

  if (pseudonym.expiresAt === null) {
    // Legacy pseudonym without a timer — start timer, keep name (no archive needed)
    pseudonym = await prisma.pseudonym.update({
      where: { id: pseudonym.id },
      data: { expiresAt: new Date(now.getTime() + PSEUDONYM_TTL_MS) },
    });
    return pseudonym;
  }

  if (pseudonym.expiresAt < now) {
    // Expired — archive old, create new random name
    const newName = await pickAnonymousName(courseId, pseudonym.publicName);
    pseudonym = await archiveAndCreate(
      userId, courseId, newName,
      new Date(now.getTime() + PSEUDONYM_TTL_MS),
    );
  }

  return pseudonym;
}

/**
 * Manually regenerate the active pseudonym for one course (profile page button).
 * Archives the old one so posts written under it keep the old name.
 */
export async function regeneratePseudonym(
  userId: string,
  courseId: string,
  currentName?: string,
) {
  const now = new Date();
  const newName = await pickAnonymousName(courseId, currentName);
  return archiveAndCreate(userId, courseId, newName, new Date(now.getTime() + PSEUDONYM_TTL_MS));
}

/**
 * Update ALL active pseudonyms for a user when they change their display mode.
 * Archives old ones and creates new ones so every course updates at once.
 */
export async function updateAllPseudonymsForUser(
  userId: string,
  email: string,
  displayMode: string,
) {
  const active = await prisma.pseudonym.findMany({
    where: { userId, isActive: true },
  });
  const now = new Date();
  const isRealName = displayMode === "REAL_NAME";

  for (const p of active) {
    if (isRealName) {
      const expectedName = await pickRealName(email, p.courseId, p.id);
      if (p.publicName !== expectedName) {
        await archiveAndCreate(p.userId, p.courseId, expectedName, null);
      } else if (p.expiresAt !== null) {
        await prisma.pseudonym.update({ where: { id: p.id }, data: { expiresAt: null } });
      }
    } else {
      if (looksLikeRealName(p.publicName, email)) {
        const newName = await pickAnonymousName(p.courseId);
        await archiveAndCreate(
          p.userId, p.courseId, newName,
          new Date(now.getTime() + PSEUDONYM_TTL_MS),
        );
      }
    }
  }
}
