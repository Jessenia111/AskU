import { onMounted, onBeforeUnmount, watch } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { apiFetch, ApiError } from "../api/client";

// Sliding inactivity window: 1 hour. If no user activity (mouse, keyboard,
// touch, scroll) is detected for this duration, the session is terminated
// on the server and the user is redirected to the login page. This mirrors
// the server-side sliding session expiry implemented in
// apps/api/src/authMiddleware.ts.
const INACTIVITY_MS = 60 * 60 * 1000;

const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
] as const;

export function useInactivityLogout() {
  const auth = useAuthStore();
  const router = useRouter();

  let timerId: number | null = null;

  function clearTimer() {
    if (timerId !== null) {
      window.clearTimeout(timerId);
      timerId = null;
    }
  }

  async function forceLogout() {
    clearTimer();
    try {
      await apiFetch("/api/v1/auth/logout", { method: "POST" });
    } catch (err) {
      // 401 means the server already invalidated the session — that is
      // exactly what we expected, so swallow it. Other errors are logged
      // but should not prevent the redirect.
      if (!(err instanceof ApiError) || err.status !== 401) {
        console.warn("[inactivity] logout request failed:", err);
      }
    }
    auth.clear();
    router.push({ name: "login", query: { reason: "inactivity" } });
  }

  function resetTimer() {
    if (!auth.isLoggedIn) return;
    clearTimer();
    timerId = window.setTimeout(forceLogout, INACTIVITY_MS);
  }

  function attachListeners() {
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, resetTimer, { passive: true });
    }
  }

  function detachListeners() {
    for (const evt of ACTIVITY_EVENTS) {
      window.removeEventListener(evt, resetTimer);
    }
  }

  onMounted(() => {
    if (auth.isLoggedIn) {
      attachListeners();
      resetTimer();
    }
  });

  watch(
    () => auth.isLoggedIn,
    (loggedIn) => {
      if (loggedIn) {
        attachListeners();
        resetTimer();
      } else {
        detachListeners();
        clearTimer();
      }
    },
  );

  onBeforeUnmount(() => {
    detachListeners();
    clearTimer();
  });
}
