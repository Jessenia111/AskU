<script setup lang="ts">
import { onMounted, ref } from "vue";

type Course = { id: string; code: string; title: string; semester: string };

const courses = ref<Course[]>([]);
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
  <div style="padding: 16px">
    <h2>Courses</h2>

    <div v-if="error" style="color: red; white-space: pre-wrap">
      {{ error }}
    </div>

    <ul v-else>
      <li v-for="c in courses" :key="c.id">
        <router-link :to="`/courses/${c.id}`">
          {{ c.code }} — {{ c.title }} ({{ c.semester }})
        </router-link>
      </li>
    </ul>
  </div>
</template>
