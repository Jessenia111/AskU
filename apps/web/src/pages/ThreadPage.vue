<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { apiFetch } from "../api/client";
import UiCard from "../components/UiCard.vue";
import ReportMenu from "../components/ReportMenu.vue";
import { useToast } from "../composables/useToast";

type ThreadDto = {
  id: string;
  courseId: string;
  author: { publicName: string };
  title: string;
  body: string;
  status: string;
  createdAt: string;
  comments: Array<{
    id: string;
    body: string;
    createdAt: string;
    author: { publicName: string };
  }>;
};

const route = useRoute();
const threadId = computed(() => String(route.params.threadId));

const toast = useToast();

const loading = ref(false);
const error = ref<string | null>(null);
const thread = ref<ThreadDto | null>(null);

const commentBody = ref("");
const commenting = ref(false);

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
    thread.value = await apiFetch<ThreadDto>(`/api/v1/threads/${threadId.value}`);
  } catch (e) {
    error.value = String(e);
  } finally {
    loading.value = false;
  }
}

async function postComment() {
  if (!thread.value) return;
  if (!commentBody.value.trim()) return;

  commenting.value = true;
  try {
    await apiFetch(`/api/v1/threads/${thread.value.id}/comments`, {
      method: "POST",
      body: JSON.stringify({ body: commentBody.value }),
    });
    commentBody.value = "";
    toast.push("success", "Comment posted");
    await load();
  } catch (e) {
    toast.push("error", `Failed to post comment: ${String(e)}`);
  } finally {
    commenting.value = false;
  }
}

async function submitReport(targetType: "THREAD" | "COMMENT", targetId: string, reason: "spam" | "abuse" | "other") {
  const key = `${targetType}:${targetId}:${reason}`;
  const now = Date.now();

  if (reportingKey.value) return;
  if (lastReportKey.value === key && now - lastReportAt.value < 2000) return;

  reportingKey.value = key;
  lastReportKey.value = key;
  lastReportAt.value = now;

  try {
    await apiFetch("/api/v1/reports", {
      method: "POST",
      body: JSON.stringify({
        targetType,
        targetId,
        reason,
      }),
    });
    toast.push("success", "Report submitted");
  } catch (e) {
    toast.push("error", `Report failed: ${String(e)}`);
  } finally {
    reportingKey.value = null;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <div v-if="loading" class="asku-muted mt-4">Loading…</div>
    <div v-if="error" class="asku-error mt-4">{{ error }}</div>

    <UiCard v-if="thread && !loading && !error">
      <div class="asku-card-pad">
        <div class="flex items-start justify-between gap-6">
          <div class="text-3xl font-semibold">{{ thread.title }}</div>
          <div class="asku-date">{{ fmt(thread.createdAt) }}</div>
        </div>

        <div class="asku-meta mt-2">
          {{ thread.author.publicName }} · {{ thread.status }}
        </div>

        <div class="asku-body mt-4 whitespace-pre-wrap">
          {{ thread.body }}
        </div>

        <div class="flex justify-end mt-6">
          <ReportMenu
            :disabled="reportingKey === `THREAD:${thread.id}:spam` || reportingKey === `THREAD:${thread.id}:abuse` || reportingKey === `THREAD:${thread.id}:other`"
            @select="(reason) => submitReport('THREAD', thread.id, reason)"
          />
        </div>
      </div>
    </UiCard>

    <UiCard v-if="thread && !loading && !error" class="mt-6">
      <div class="asku-card-pad">
        <div class="text-2xl font-semibold mb-4">Comments</div>

        <div class="flex flex-col gap-3 mb-6">
          <textarea
            v-model="commentBody"
            class="asku-textarea"
            rows="4"
            placeholder="Write a comment…"
          />
          <div class="flex items-center gap-3">
            <button class="asku-btn" :disabled="commenting || !commentBody.trim()" @click="postComment">
              {{ commenting ? "Posting..." : "Post comment" }}
            </button>
          </div>
        </div>

        <div v-if="thread.comments.length === 0" class="asku-muted">
          No comments yet.
        </div>

        <div v-else class="flex flex-col gap-4">
          <UiCard v-for="c in thread.comments" :key="c.id" :topbar="false">
            <div class="asku-card-pad">
              <div class="flex items-start justify-between gap-6">
                <div class="asku-meta">
                  {{ c.author.publicName }}
                </div>
                <div class="asku-date">{{ fmt(c.createdAt) }}</div>
              </div>

              <div class="asku-body mt-2 whitespace-pre-wrap">
                {{ c.body }}
              </div>

              <div class="flex justify-end mt-4">
                <ReportMenu
                  :disabled="reportingKey?.startsWith(`COMMENT:${c.id}:`) ?? false"
                  @select="(reason) => submitReport('COMMENT', c.id, reason)"
                />
              </div>
            </div>
          </UiCard>
        </div>
      </div>
    </UiCard>
  </div>
</template>
