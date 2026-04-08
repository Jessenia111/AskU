<script setup lang="ts">
import { onMounted, ref } from "vue";
import { apiFetch, ApiError } from "../api/client";

type Course = { id: string; code: string; title: string; semester: string };

const courses = ref<Course[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    courses.value = await apiFetch<Course[]>("/api/v1/courses");
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <h1 class="asku-page-title">Courses</h1>

    <div v-if="loading" class="asku-muted">Loading…</div>
    <div v-if="error" class="asku-error">{{ error }}</div>

    <div v-if="!loading && !error && courses.length === 0" class="flex flex-col items-center gap-3 py-16 text-center">
      <div class="text-lg font-semibold text-slate-700">No courses yet</div>
      <div class="text-sm text-slate-400">Courses will appear here once they are added.</div>
    </div>

    <div v-if="!loading && !error && courses.length > 0" class="asku-grid">
      <router-link
        v-for="c in courses"
        :key="c.id"
        :to="`/courses/${c.id}`"
        class="no-underline"
      >
        <div class="asku-card h-full">
          <div class="asku-card-topbar"></div>
          <div class="asku-card-pad">
            <div class="text-xl font-bold text-blue-700">{{ c.code }}</div>
            <div class="mt-1.5 text-lg text-slate-700">{{ c.title }}</div>
            <div class="mt-3 text-sm text-slate-500">{{ c.semester }}</div>
          </div>
        </div>
      </router-link>
    </div>
  </div>
</template>
