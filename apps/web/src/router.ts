import { createRouter, createWebHistory } from "vue-router";
import CoursesPage from "./pages/CoursesPage.vue";
import CourseThreadsPage from "./pages/CourseThreadsPage.vue";
import ThreadPage from "./pages/ThreadPage.vue";
import LoginPage from "./pages/LoginPage.vue";
import VerifyPage from "./pages/VerifyPage.vue";
import { apiFetch } from "./api/client";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/courses" },

    { path: "/login", component: LoginPage },
    { path: "/verify", component: VerifyPage },

    { path: "/courses", component: CoursesPage },
    { path: "/courses/:courseId", component: CourseThreadsPage },
    { path: "/threads/:threadId", component: ThreadPage },
  ],
});

router.beforeEach(async (to) => {
  if (to.path === "/login" || to.path === "/verify") return true;

  try {
    await apiFetch("/api/v1/me");
    return true;
  } catch {
    return { path: "/login" };
  }
});

export default router;