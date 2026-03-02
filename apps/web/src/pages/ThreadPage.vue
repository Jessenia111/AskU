<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { apiFetch } from "../api/client";
import UiCard from "../components/UiCard.vue";
import ReportMenu from "../components/ReportMenu.vue";
import { useToast } from "../composables/useToast";

type ThreadDto = {
  id: string;
  courseId: string;
  author: { publicName: string };
  isMine: boolean;
  title: string;
  body: string;
  status: string;
  createdAt: string;
  comments: Array<{
    id: string;
    body: string;
    createdAt: string;
    author: { publicName: string };
    isMine: boolean;
  }>;
};

const route = useRoute();
const router = useRouter();
const toast = useToast();

const threadId = computed(() => String(route.params.threadId));

const loading = ref(false);
const error = ref<string | null>(null);
const thread = ref<ThreadDto | null>(null);

const commentBody = ref("");
const posting = ref(false);

const reportingKey = ref<string | null>(null);
const lastReportKey = ref<string | null>(null);
const lastReportAt = ref(0);

const actingKey = ref<string | null>(null);

const modKey = computed(() => (localStorage.getItem("ASKU_MOD_KEY") ?? "").trim());
const hasMod = computed(() => !!modKey.value);

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
    thread.value = null;
  } finally {
    loading.value = false;
  }
}

async function postComment() {
  if (!thread.value) return;
  const body = commentBody.value.trim();
  if (!body) return;

  posting.value = true;
  try {
    await apiFetch(`/api/v1/threads/${thread.value.id}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
    commentBody.value = "";
    toast.push("success", "Comment posted");
    await load();
    window.setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), 50);
  } catch (e) {
    toast.push("error", `Failed to post comment: ${String(e)}`);
  } finally {
    posting.value = false;
  }
}

async function submitReport(
  targetType: "THREAD" | "COMMENT",
  targetId: string,
  reason: "spam" | "abuse"
) {
  const key = `${targetType}:${targetId}:${reason}`;
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
        targetType,
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

async function modAct(
  targetType: "THREAD" | "COMMENT",
  targetId: string,
  actionType: "HIDE" | "DELETE"
) {
  if (!hasMod.value) {
    toast.push("error", "Missing MOD_KEY (open Moderation page and save it)");
    return;
  }

  const key = `${actionType}:${targetType}:${targetId}`;
  if (actingKey.value) return;
  actingKey.value = key;

  try {
    await apiFetch("/api/v1/moderation/actions", {
      method: "POST",
      headers: { "x-mod-key": modKey.value },
      body: JSON.stringify({
        actionType,
        targetType,
        targetId,
        note: "",
      }),
    });

    toast.push("success", `${actionType} applied`);
    await load();
  } catch (e) {
    toast.push("error", `Action failed: ${String(e)}`);
  } finally {
    actingKey.value = null;
  }
}

async function deleteThreadAsAuthor() {
  if (!thread.value) return;
  if (!thread.value.isMine) return;

  const t = thread.value;

  try {
    await apiFetch(`/api/v1/threads/${t.id}`, { method: "DELETE" });
    toast.push("success", "Thread deleted");
    await router.push(`/courses/${t.courseId}`);
  } catch (e) {
    toast.push("error", `Delete failed: ${String(e)}`);
  }
}

async function deleteCommentAsAuthor(commentId: string) {
  if (!thread.value) return;

  const c = thread.value.comments.find((x) => x.id === commentId);
  if (!c || !c.isMine) return;

  try {
    await apiFetch(`/api/v1/comments/${commentId}`, { method: "DELETE" });
    toast.push("success", "Comment deleted");
    await load();
  } catch (e) {
    toast.push("error", `Delete failed: ${String(e)}`);
  }
}

const backTo = computed(() => {
  if (thread.value) return `/courses/${thread.value.courseId}`;
  return "/courses";
});

onMounted(load);
</script>

<template>
  <div>
    <div class="asku-subheader">
      <router-link class="asku-back" :to="backTo">← Back to Threads</router-link>
      <div class="asku-section-title">Thread</div>
    </div>

    <div v-if="loading" class="asku-muted mt-4">Loading…</div>
    <div v-if="error" class="asku-error mt-4">{{ error }}</div>

    <div v-if="thread" class="flex flex-col gap-6 mt-4">
      <UiCard>
        <div class="asku-card-pad">
          <div class="flex items-start justify-between gap-6">
            <div class="text-3xl font-semibold">{{ thread.title }}</div>
            <div class="asku-date">{{ fmt(thread.createdAt) }}</div>
          </div>

          <div class="asku-meta mt-2">
            {{ thread.author.publicName }} · {{ thread.status }}
          </div>

          <div class="asku-body mt-4">
            {{ thread.body }}
          </div>

          <div class="flex items-center justify-end gap-2 mt-6">
            <ReportMenu
              :disabled="(reportingKey?.startsWith(`THREAD:${thread.id}:`) ?? false)"
              @select="(reason) => submitReport('THREAD', thread.id, reason)"
            />

            <button
              v-if="thread.isMine"
              class="asku-btn"
              :disabled="actingKey === `AUTHOR:DELETE:THREAD:${thread.id}`"
              @click="deleteThreadAsAuthor"
            >
              Delete
            </button>

            <template v-if="hasMod">
              <button
                class="asku-btn-ghost"
                :disabled="actingKey === `HIDE:THREAD:${thread.id}`"
                @click="modAct('THREAD', thread.id, 'HIDE')"
              >
                {{ actingKey === `HIDE:THREAD:${thread.id}` ? "Working..." : "Hide" }}
              </button>
              <button
                class="asku-btn"
                :disabled="actingKey === `DELETE:THREAD:${thread.id}`"
                @click="modAct('THREAD', thread.id, 'DELETE')"
              >
                {{ actingKey === `DELETE:THREAD:${thread.id}` ? "Working..." : "Delete" }}
              </button>
            </template>
          </div>

          <div v-if="hasMod" class="text-xs text-slate-500 mt-2">
            Moderator tools enabled (MOD_KEY найден в localStorage).
          </div>
        </div>
      </UiCard>

      <UiCard :topbar="false">
        <div class="asku-card-pad">
          <div class="text-2xl font-semibold mb-4">Comments</div>

          <div v-if="thread.comments.length === 0" class="asku-muted">
            No comments yet.
          </div>

          <div v-else class="flex flex-col gap-4">
            <UiCard v-for="c in thread.comments" :key="c.id">
              <div class="asku-card-pad">
                <div class="flex items-start justify-between gap-6">
                  <div class="asku-meta">
                    {{ c.author.publicName }}
                  </div>
                  <div class="asku-date">{{ fmt(c.createdAt) }}</div>
                </div>

                <div class="asku-body mt-2">
                  {{ c.body }}
                </div>

                <div class="flex items-center justify-end gap-2 mt-4">
                  <ReportMenu
                    :disabled="(reportingKey?.startsWith(`COMMENT:${c.id}:`) ?? false)"
                    @select="(reason) => submitReport('COMMENT', c.id, reason)"
                  />

                  <button
                    v-if="c.isMine"
                    class="asku-btn"
                    @click="deleteCommentAsAuthor(c.id)"
                  >
                    Delete
                  </button>

                  <template v-if="hasMod">
                    <button
                      class="asku-btn-ghost"
                      :disabled="actingKey === `HIDE:COMMENT:${c.id}`"
                      @click="modAct('COMMENT', c.id, 'HIDE')"
                    >
                      {{ actingKey === `HIDE:COMMENT:${c.id}` ? "Working..." : "Hide" }}
                    </button>
                    <button
                      class="asku-btn"
                      :disabled="actingKey === `DELETE:COMMENT:${c.id}`"
                      @click="modAct('COMMENT', c.id, 'DELETE')"
                    >
                      {{ actingKey === `DELETE:COMMENT:${c.id}` ? "Working..." : "Delete" }}
                    </button>
                  </template>
                </div>
              </div>
            </UiCard>
          </div>
        </div>
      </UiCard>

      <UiCard :topbar="false">
        <div class="asku-card-pad">
          <div class="text-xl font-semibold mb-3">Write a comment</div>

          <textarea
            v-model="commentBody"
            class="asku-textarea"
            rows="4"
            placeholder="Write a comment…"
          />

          <div class="flex justify-end mt-3">
            <button
              class="asku-btn"
              :disabled="posting || !commentBody.trim()"
              @click="postComment"
            >
              {{ posting ? "Posting..." : "Post comment" }}
            </button>
          </div>
        </div>
      </UiCard>
    </div>
  </div>
</template>