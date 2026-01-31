import { createRouter, createWebHistory } from "vue-router";
import CoursesPage from "./pages/CoursesPage.vue";
import CourseThreadsPage from "./pages/CourseThreadsPage.vue";
import ThreadPage from "./pages/ThreadPage.vue";

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: CoursesPage },
    { path: "/courses/:courseId", component: CourseThreadsPage },
    { path: "/threads/:threadId", component: ThreadPage },
  ],
});
