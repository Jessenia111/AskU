<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { apiFetch } from "../api/client";

const router = useRouter();

const me = ref<{ id: string; email: string } | null>(null);
const meLoading = ref(false);
const meError = ref<string | null>(null);

async function loadMe() {
  meLoading.value = true;
  meError.value = null;
  try {
    me.value = await apiFetch<{ id: string; email: string }>("/api/v1/me");
  } catch (e: any) {
    meError.value = typeof e?.message === "string" ? e.message : String(e);
  } finally {
    meLoading.value = false;
  }
}

const logoutLoading = ref(false);

async function logout() {
  logoutLoading.value = true;
  try {
    await apiFetch("/api/v1/auth/logout", { method: "POST" });
  } finally {
    logoutLoading.value = false;
    router.push("/login");
  }
}

onMounted(loadMe);

type Course = { id: string; code: string; title: string; semester: string; term: string };

const courses = ref<Course[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    const res = await fetch("http://127.0.0.1:8000/api/v1/courses");
    if (!res.ok) throw new Error(await res.text());
    courses.value = await res.json();
  } catch (e) {
    error.value = String(e);
  }
});
</script>

<template>
  <div class="flex items-center justify-between mb-6">
  <div class="text-sm text-zinc-600">
    <span v-if="meLoading">Loading user…</span>
    <span v-else-if="me">Logged in as <span class="font-medium">{{ me.email }}</span></span>
    <span v-else-if="meError">Session issue: {{ meError }}</span>
  </div>

  <button
    class="rounded-xl border border-zinc-300 px-4 py-2 text-zinc-900 disabled:opacity-60"
    :disabled="logoutLoading"
    @click="logout"
  >
    {{ logoutLoading ? "Logging out…" : "Log out" }}
  </button>
</div>
  <div class="asku-page">
    <div class="asku-container">
      <h1 class="asku-title">Courses</h1>

      <div v-if="loading" class="asku-muted">Loading…</div>
      <div v-if="error" style="color:#dc2626; white-space:pre-wrap">{{ error }}</div>

      <div v-if="!loading && !error" class="asku-grid asku-grid-2">
        <router-link
          v-for="c in courses"
          :key="c.id"
          :to="`/courses/${c.id}`"
          style="text-decoration:none"
        >
          <div class="asku-card">
            <div class="asku-card-topbar"></div>
            <div class="asku-card-pad">
              <div style="font-size:22px; font-weight:700; color:#1d4ed8">{{ c.code }}</div>
              <div style="font-size:18px; margin-top:6px; color:#334155">{{ c.title }}</div>
              <div class="asku-muted" style="margin-top:14px">{{ c.term }}</div>
            </div>
          </div>
        </router-link>
      </div>
    </div>
  </div>
</template>
