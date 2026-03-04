import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { apiFetch } from "../api/client";

type Me = { id: string; email: string };

export const useAuthStore = defineStore("auth", () => {
  const user = ref<Me | null>(null);
  const loading = ref(false);
  const checked = ref(false); // true once we've fetched at least once

  const isLoggedIn = computed(() => !!user.value);
  const initials = computed(() => {
    if (!user.value?.email) return "U";
    return user.value.email[0].toUpperCase();
  });

  async function fetchMe(): Promise<boolean> {
    // If already loaded, return immediately
    if (checked.value) return isLoggedIn.value;

    loading.value = true;
    try {
      user.value = await apiFetch<Me>("/api/v1/me");
      checked.value = true;
      return true;
    } catch {
      user.value = null;
      checked.value = true;
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function refresh() {
    checked.value = false;
    return fetchMe();
  }

  function clear() {
    user.value = null;
    checked.value = false;
  }

  return { user, loading, checked, isLoggedIn, initials, fetchMe, refresh, clear };
});
