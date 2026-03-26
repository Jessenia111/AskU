<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { apiFetch, ApiError } from "../api/client";
import UiCard from "../components/UiCard.vue";
import ReportMenu from "../components/ReportMenu.vue";
import PseudonymBadge from "../components/PseudonymBadge.vue";
import { useToast } from "../composables/useToast";

type ThreadListItem = {
  id: string;
  courseId: string;
  author: { pseudonymId: string; publicName: string };
  title: string;
  bodyPreview: string;
  status: string;
  createdAt: string;
};

type ThreadsPage = { courseTitle: string; items: ThreadListItem[]; total: number; skip: number; take: number };

const route = useRoute();
const courseId = computed(() => String(route.params.courseId));

const toast = useToast();

const threads = ref<ThreadListItem[]>([]);
const total = ref(0);
const loadingMore = ref(false);
const loading = ref(false);
// Separate error for page load vs form submission
const loadError = ref<string | null>(null);
const createError = ref<string | null>(null);

const myPseudonym = ref<string | null>(null);
const courseName = ref<string | null>(null);

const showNew = ref(false);
const title = ref("");
const body = ref("");
const submitting = ref(false);

// Fix #4: title validation message
const titleError = computed(() => {
  if (!title.value) return null;
  if (title.value.trim().length < 3) return "Title must be at least 3 characters.";
  return null;
});
const canPost = computed(() => !submitting.value && title.value.trim().length >= 3 && body.value.trim().length > 0);

// Fix #6: track which thread IDs have already been reported
const reportingKey = ref<string | null>(null);
const reportedIds = ref<Set<string>>(new Set());

const PAGE_SIZE = 20;
const hasMore = computed(() => threads.value.length < total.value);

function fmt(s: string) {
  return new Date(s).toLocaleString();
}

async function load() {
  loading.value = true;
  loadError.value = null;
  try {
    const [page, pseudonymData] = await Promise.all([
      apiFetch<ThreadsPage>(`/api/v1/courses/${courseId.value}/threads?skip=0&take=${PAGE_SIZE}`),
      apiFetch<{ publicName: string | null }>(`/api/v1/courses/${courseId.value}/my-pseudonym`).catch(() => ({ publicName: null })),
    ]);
    threads.value = page.items;
    total.value = page.total;
    courseName.value = page.courseTitle;
    myPseudonym.value = pseudonymData.publicName;
  } catch (e) {
    loadError.value = e instanceof ApiError ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  loadingMore.value = true;
  try {
    const page = await apiFetch<ThreadsPage>(
      `/api/v1/courses/${courseId.value}/threads?skip=${threads.value.length}&take=${PAGE_SIZE}`
    );
    threads.value.push(...page.items);
    total.value = page.total;
  } catch (e) {
    toast.push("error", e instanceof ApiError ? e.message : String(e));
  } finally {
    loadingMore.value = false;
  }
}

async function createThread() {
  submitting.value = true;
  createError.value = null;
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
    const msg = e instanceof ApiError ? e.message : String(e);
    // Fix #5: show form error without hiding the thread list
    createError.value = msg;
    toast.push("error", msg);
  } finally {
    submitting.value = false;
  }
}

async function submitReport(targetId: string, reason: "spam" | "abuse") {
  if (reportingKey.value) return;
  // Fix #6: permanently block re-reporting the same thread
  if (reportedIds.value.has(targetId)) return;

  reportingKey.value = targetId;

  const label = reason === "spam" ? "Spam" : "Abuse";
  const apiReason = reason === "spam" ? "SPAM" : "ABUSE";

  try {
    await apiFetch("/api/v1/reports", {
      method: "POST",
      body: JSON.stringify({ targetType: "THREAD", targetId, reason: apiReason }),
    });
    reportedIds.value.add(targetId);
    toast.push("success", `Report submitted: ${label}`);
  } catch (e) {
    toast.push("error", e instanceof ApiError ? e.message : `Report failed (${label})`);
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
      <div class="flex flex-col">
        <div class="asku-section-title">Threads</div>
        <div v-if="courseName" class="text-sm text-slate-500 -mt-1">{{ courseName }}</div>
      </div>
      <div v-if="myPseudonym" class="ml-auto flex items-center gap-2 text-sm text-slate-500">
        You are
        <span class="rounded-lg bg-blue-50 px-2.5 py-1 text-sm font-semibold text-blue-700">
          {{ myPseudonym }}
        </span>
      </div>
    </div>

    <button class="asku-link-action" @click="showNew = !showNew">
      Post New Thread
    </button>

    <UiCard v-if="showNew" :topbar="false">
      <div class="asku-card-pad">
        <div class="flex items-center justify-between mb-4">
          <div class="text-2xl font-semibold">Post New Thread</div>
          <div v-if="myPseudonym" class="text-sm text-slate-500">
            Posting as
            <span class="font-semibold text-blue-700">{{ myPseudonym }}</span>
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <div>
            <input v-model="title" class="asku-input" placeholder="Title (min. 3 characters)" />
            <!-- Fix #4: validation message -->
            <p v-if="titleError" class="mt-1 text-xs text-red-500">{{ titleError }}</p>
          </div>
          <textarea v-model="body" class="asku-textarea" rows="5" placeholder="Body" />

          <!-- Fix #5: form error shown inside form, not over thread list -->
          <div v-if="createError" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {{ createError }}
          </div>

          <div class="flex items-center gap-3">
            <button
              class="asku-btn"
              :disabled="!canPost"
              @click="createThread"
            >
              {{ submitting ? "Posting..." : "Post" }}
            </button>
            <button class="asku-btn-ghost" :disabled="submitting" @click="showNew = false; createError = null">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </UiCard>

    <div v-if="loading" class="asku-muted mt-4">Loading…</div>
    <div v-if="loadError" class="asku-error mt-4">{{ loadError }}</div>

    <!-- Fix #5: threads always visible even after form error -->
    <div v-if="!loading && !loadError" class="flex flex-col gap-6 mt-4">
      <!-- Empty state -->
      <div v-if="threads.length === 0" class="flex flex-col items-center gap-3 py-16 text-center">
        <div class="text-lg font-semibold text-slate-700">No threads yet</div>
        <div class="text-sm text-slate-400">Be the first to start a discussion in this course.</div>
        <button class="asku-btn mt-2" @click="showNew = true">Post the first thread</button>
      </div>

      <UiCard v-for="t in threads" :key="t.id">
        <div class="asku-card-pad">
          <div class="flex items-start justify-between gap-6">
            <router-link class="asku-thread-title" :to="`/threads/${t.id}`">
              {{ t.title }}
            </router-link>
            <div class="asku-date">{{ fmt(t.createdAt) }}</div>
          </div>

          <div class="asku-meta">
            <PseudonymBadge :pseudonym-id="t.author.pseudonymId" :public-name="t.author.publicName" />
            · {{ t.status }}
          </div>

          <div class="asku-body">
            {{ t.bodyPreview }}
          </div>

          <div class="flex justify-end mt-6">
            <!-- Fix #6: disabled after reported -->
            <ReportMenu
              :disabled="reportingKey === t.id || reportedIds.has(t.id)"
              :reported="reportedIds.has(t.id)"
              @select="(reason) => submitReport(t.id, reason)"
            />
          </div>
        </div>
      </UiCard>

      <!-- Load more -->
      <div v-if="hasMore" class="flex justify-center pb-4">
        <button
          class="asku-btn-ghost"
          :disabled="loadingMore"
          @click="loadMore"
        >
          {{ loadingMore ? "Loading…" : `Load more (${total - threads.length} remaining)` }}
        </button>
      </div>
    </div>
  </div>
</template>