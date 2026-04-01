import { createRouter, createWebHistory } from "vue-router";
import CoursesPage from "./pages/CoursesPage.vue";
import CourseThreadsPage from "./pages/CourseThreadsPage.vue";
import ThreadPage from "./pages/ThreadPage.vue";
import LoginPage from "./pages/LoginPage.vue";
import VerifyPage from "./pages/VerifyPage.vue";
import { useAuthStore } from "./stores/auth";

const REDIRECT_KEY = "asku_login_redirect";

// Routes that do not require authentication
const PUBLIC_PATHS = ["/login", "/verify", "/info"];

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/courses" },
    { path: "/login", component: LoginPage },
    { path: "/verify", component: VerifyPage },
    { path: "/info", component: () => import("./pages/InfoPage.vue") },
    { path: "/courses", component: CoursesPage },
    { path: "/courses/:courseId", component: CourseThreadsPage },
    { path: "/threads/:threadId", component: ThreadPage },
    { path: "/moderation", component: () => import("./pages/ModerationPage.vue") },
    { path: "/profile", component: () => import("./pages/ProfilePage.vue") },
    ...(import.meta.env.DEV ? [{ path: "/dev", component: () => import("./pages/DevPage.vue") }] : []),
    { path: "/:pathMatch(.*)*", component: () => import("./pages/NotFoundPage.vue") },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (PUBLIC_PATHS.includes(to.path)) {
    // For login/verify: redirect away if already logged in
    if (to.path === "/login" || to.path === "/verify") {
      const loggedIn = await auth.fetchMe();
      if (loggedIn) {
        const redirect = sessionStorage.getItem(REDIRECT_KEY) ?? "/courses";
        sessionStorage.removeItem(REDIRECT_KEY);
        return { path: redirect };
      }
    }
    return true;
  }

  const loggedIn = await auth.fetchMe(); // uses cache — no network call if already checked
  if (!loggedIn) {
    // Save where the user wanted to go so we can redirect them after login
    sessionStorage.setItem(REDIRECT_KEY, to.fullPath);
    return { path: "/login" };
  }
  return true;
});

export { REDIRECT_KEY };
export default router;
