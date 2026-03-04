import { createRouter, createWebHistory } from "vue-router";
import CoursesPage from "./pages/CoursesPage.vue";
import CourseThreadsPage from "./pages/CourseThreadsPage.vue";
import ThreadPage from "./pages/ThreadPage.vue";
import LoginPage from "./pages/LoginPage.vue";
import VerifyPage from "./pages/VerifyPage.vue";
import { useAuthStore } from "./stores/auth";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/courses" },
    { path: "/login", component: LoginPage },
    { path: "/verify", component: VerifyPage },
    { path: "/courses", component: CoursesPage },
    { path: "/courses/:courseId", component: CourseThreadsPage },
    { path: "/threads/:threadId", component: ThreadPage },
    { path: "/moderation", component: () => import("./pages/ModerationPage.vue") },
  ],
});

router.beforeEach(async (to) => {
  if (to.path === "/login" || to.path === "/verify") return true;

  const auth = useAuthStore();
  const loggedIn = await auth.fetchMe(); // uses cache — no network call if already checked
  if (!loggedIn) return { path: "/login" };
  return true;
});

export default router;
