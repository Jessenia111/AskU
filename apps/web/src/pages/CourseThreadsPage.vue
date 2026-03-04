<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { apiFetch } from "../api/client";
import UiCard from "../components/UiCard.vue";
import ReportMenu from "../components/ReportMenu.vue";
import { useToast } from "../composables/useToast";

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

const toast = useToast();

const threads = ref<ThreadListItem[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const showNew = ref(false);
const title = ref("");
const body = ref("");
const submitting = ref(false);

const reportingKey = ref<string | null>(null);
const lastReportKey = ref<string | null>(null);
const lastReportAt = ref(0);

function fmt(s: string) {
  return new Date(s).toLocaleString();
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    threads.value = await apiFetch<ThreadListItem[]>(
      `/api/v1/courses/${courseId.value}/threads`
    );
  } catch (e) {
    error.value = String(e);
  } finally {
    loading.value = false;
  }
}

async function createThread() {
  submitting.value = true;
  error.value = null;
  try {
    await apiFetch(`/api/v1/courses/${courseId.value}/threads`, {
      method: "POST",
      body: JSON.stringify({ title: title.value, body: body.value }),
    });
    title.value = "";
    body.value = "";
    showNew.value = false;
    toast.push("success", "Thread posted");
    await load();
  } catch (e) {
    toast.push("error", `Failed to post thread: ${String(e)}`);
    error.value = String(e);
  } finally {
    submitting.value = false;
  }
}

async function submitReport(targetId: string, reason: "spam" | "abuse") {
  const key = `THREAD:${targetId}:${reason}`;
  const now = Date.now();

  if (reportingKey.value) return;
  if (lastReportKey.value === key && now - lastReportAt.value < 1200) return;

  reportingKey.value = key;
  lastReportKey.value = key;
  lastReportAt.value = now;

  const label = reason === "spam" ? "Spam" : "Abuse";
  const apiReason = reason === "spam" ? "SPAM" : "ABUSE";

  try {
    await apiFetch("/api/v1/reports", {
      method: "POST",
      body: JSON.stringify({
        targetType: "THREAD",
        targetId,
        reason: apiReason,
      }),
    });

    toast.push("success", `Report submitted: ${label}`);
  } catch (e) {
    toast.push("error", `Report failed (${label}): ${String(e)}`);
  } finally {
    reportingKey.value = null;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="asku-subheader">
      <router-link class="asku-back" to="/courses">← Courses</router-link>
      <div class="asku-section-title">Threads</div>
    </div>

    <button class="asku-link-action" @click="showNew = !showNew">
      Post New Thread
    </button>

    <UiCard v-if="showNew" :topbar="false">
      <div class="asku-card-pad">
        <div class="text-2xl font-semibold mb-4">Post New Thread</div>

        <div class="flex flex-col gap-3">
          <input v-model="title" class="asku-input" placeholder="Title" />
          <textarea v-model="body" class="asku-textarea" rows="5" placeholder="Body" />

          <div class="flex items-center gap-3">
            <button
              class="asku-btn"
              :disabled="submitting || !title.trim() || !body.trim()"
              @click="createThread"
            >
              {{ submitting ? "Posting..." : "Post" }}
            </button>
            <button class="asku-btn-ghost" :disabled="submitting" @click="showNew = false">
              Cancel
            </button>
          </div>

        </div>
      </div>
    </UiCard>

    <div v-if="loading" class="asku-muted mt-4">Loading…</div>
    <div v-if="error" class="asku-error mt-4">{{ error }}</div>

    <div v-if="!loading && !error" class="flex flex-col gap-6 mt-4">
      <UiCard v-for="t in threads" :key="t.id">
        <div class="asku-card-pad">
          <div class="flex items-start justify-between gap-6">
            <router-link class="asku-thread-title" :to="`/threads/${t.id}`">
              {{ t.title }}
            </router-link>
            <div class="asku-date">{{ fmt(t.createdAt) }}</div>
          </div>

          <div class="asku-meta">
            {{ t.author.publicName }} · {{ t.status }}
          </div>

          <div class="asku-body">
            {{ t.bodyPreview }}
          </div>

          <div class="flex justify-end mt-6">
            <ReportMenu
              :disabled="(reportingKey?.startsWith(`THREAD:${t.id}:`) ?? false)"
              @select="(reason) => submitReport(t.id, reason)"
            />
          </div>
        </div>
      </UiCard>

      <div v-if="threads.length === 0" class="asku-muted">
        No threads yet.
      </div>
    </div>
  </div>
</template>