<script setup lang="ts">
import { onMounted, ref } from "vue";
import { apiFetch } from "../api/client";

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
    error.value = String(e);
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

    <div v-if="!loading && !error && courses.length === 0" class="asku-muted">
      No courses available yet.
    </div>

    <div v-if="!loading && !error && courses.length > 0" class="asku-grid">
      <router-link
        v-for="c in courses"
        :key="c.id"
        :to="`/courses/${c.id}`"
        style="text-decoration:none"
      >
        <div class="asku-card h-full">
          <div class="asku-card-topbar"></div>
          <div class="asku-card-pad">
            <div style="font-size:22px; font-weight:700; color:#1d4ed8">{{ c.code }}</div>
            <div style="font-size:18px; margin-top:6px; color:#334155">{{ c.title }}</div>
            <div class="asku-muted" style="margin-top:14px">{{ c.semester }}</div>
          </div>
        </div>
      </router-link>
    </div>
  </div>
</template>
