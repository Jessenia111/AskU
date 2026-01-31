<script setup lang="ts">
import {ref, computed, onMounted} from "vue";
import { useRoute } from "vue-router";

type ThreadListItem = {
  id: string;
  courseId: string;
  author: { publicName: string };
  title: string;
  bodyPreview: string;
  status: string;
  createdAt: string;
};

const route = useRoute();
const courseId = computed(() => String(route.params.courseId));

const threads = ref<ThreadListItem[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);

const title = ref("");
const body = ref("");
const submitting = ref(false);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const res = await fetch(`http://127.0.0.1:8000/api/v1/courses/${courseId.value}/threads`);
    if (!res.ok) throw new Error(await res.text());
    threads.value = await res.json();
  } catch (e) {
    error.value = String(e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

async function createThread() {
  submitting.value = true;
  error.value = null;
  try {
    const res = await fetch(`http://127.0.0.1:8000/api/v1/courses/${courseId.value}/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.value, body: body.value }),
    });
    if (!res.ok) throw new Error(await res.text());

    title.value = "";
    body.value = "";
    await load();
  } catch (e) {
    error.value = String(e);
  } finally {
    submitting.value = false;
  }
}

function fmt(s: string) {
  return new Date(s).toLocaleString();
  
}
</script>

<template>
  <div style="padding: 16px; max-width: 900px">
    <div style="display:flex; gap:12px; align-items:center; margin-bottom: 12px">
      <router-link to="/">← Courses</router-link>
      <h2 style="margin:0">Threads</h2>
    </div>

    <div style="border:1px solid #ddd; padding:12px; border-radius:8px; margin-bottom:16px">
      <h3 style="margin-top:0">Create a thread</h3>

      <div style="display:flex; flex-direction:column; gap:8px">
        <input v-model="title" placeholder="Title" style="padding:8px" />
        <textarea v-model="body" placeholder="Body" rows="4" style="padding:8px"></textarea>

        <button :disabled="submitting" @click="createThread" style="padding:10px">
          {{ submitting ? "Creating..." : "Create" }}
        </button>

        <div style="font-size:12px; color:#666">
          Note: rate limit is enabled (3 threads/hour). If you spam, you'll get 429.
        </div>
      </div>
    </div>

    <div v-if="loading">Loading…</div>
    <div v-if="error" style="color:red; white-space: pre-wrap">{{ error }}</div>

    <div v-if="!loading && !error && threads.length === 0" style="color:#666">
      No threads yet.
    </div>

    <ul v-if="threads.length" style="display:flex; flex-direction:column; gap:10px; padding-left:0; list-style:none">
      <li v-for="t in threads" :key="t.id" style="border:1px solid #ddd; padding:12px; border-radius:8px">
        <div style="display:flex; justify-content:space-between; gap:12px">
          <router-link :to="`/threads/${t.id}`" style="font-weight:600">
            {{ t.title }}
          </router-link>
          <div style="font-size:12px; color:#666">{{ fmt(t.createdAt) }}</div>
        </div>
        <div style="font-size:12px; color:#666; margin-top:6px">
          {{ t.author.publicName }} · {{ t.status }}
        </div>
        <div style="margin-top:8px; color:#333">{{ t.bodyPreview }}</div>
      </li>
    </ul>
  </div>
</template>
