import { PrismaClient, RoleName } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1) Roles
  const roles: RoleName[] = ["STUDENT", "STAFF", "MODERATOR", "ADMIN"];
  for (const name of roles) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // 2) User
  const user = await prisma.user.upsert({
    where: { utSubject: "dev-user-1" },
    update: {},
    create: {
      utSubject: "dev-user-1",
      email: "dev1@example.com",
    },
  });

  // 3) Assign STUDENT role
  const studentRole = await prisma.role.findUniqueOrThrow({
    where: { name: "STUDENT" },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: studentRole.id } },
    update: {},
    create: { userId: user.id, roleId: studentRole.id },
  });

  // 4) Course
  const course = await prisma.course.upsert({
    where: { code_semester: { code: "DEMO.101", semester: "2026S" } },
    update: { title: "Demo Course" },
    create: {
      code: "DEMO.101",
      title: "Demo Course",
      semester: "2026S",
    },
  });

  // 5) Enrollment
  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
    update: {},
    create: { userId: user.id, courseId: course.id, enrollmentRole: "STUDENT" },
  });

  // 6) Pseudonym (course-scoped)
  const pseudonym = await prisma.pseudonym.upsert({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
    update: {},
    create: {
      userId: user.id,
      courseId: course.id,
      publicName: "Anonymous #101",
    },
  });

  // 7) Thread
  const thread = await prisma.thread.create({
    data: {
      courseId: course.id,
      authorPseudonymId: pseudonym.id,
      title: "How does verified anonymity work?",
      body: "Can someone explain how AskU keeps anonymity but still stays safe?",
    },
  });

  // 8) Comment
  await prisma.comment.create({
    data: {
      threadId: thread.id,
      authorPseudonymId: pseudonym.id,
      body: "Verified anonymity means UT knows who you are, but students only see a pseudonym.",
    },
  });

  console.log("Seed completed:");
  console.log({ userId: user.id, courseId: course.id, pseudonymId: pseudonym.id, threadId: thread.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

