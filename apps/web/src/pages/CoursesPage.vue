<script setup lang="ts">
import { onMounted, ref } from "vue";

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
