<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { apiFetch, ApiError } from "../api/client";
import UiCard from "../components/UiCard.vue";
import ReportMenu from "../components/ReportMenu.vue";
import ConfirmModal from "../components/ConfirmModal.vue";
import PseudonymBadge from "../components/PseudonymBadge.vue";
import { useToast } from "../composables/useToast";
import { useAuthStore } from "../stores/auth";

type ThreadDto = {
  id: string;
  courseId: string;
  author: { pseudonymId: string; publicName: string };
  isMine: boolean;
  title: string;
  body: string;
  imageUrl: string | null;
  status: string;
  createdAt: string;
  comments: Array<{
    id: string;
    body: string;
    imageUrl: string | null;
    createdAt: string;
    author: { pseudonymId: string; publicName: string };
    isMine: boolean;
    likeCount: number;
    iLiked: boolean;
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
const commentImageUrl = ref<string | null>(null);
const posting = ref(false);
let pollInterval: ReturnType<typeof setInterval> | null = null;

// Gallery lightbox
const lightboxIndex = ref<number | null>(null);

const allImages = computed<string[]>(() => {
  if (!thread.value) return [];
  const imgs: string[] = [];
  if (thread.value.imageUrl) imgs.push(thread.value.imageUrl);
  for (const c of thread.value.comments) {
    if (c.imageUrl) imgs.push(c.imageUrl);
  }
  return imgs;
});

const lightboxSrc = computed(() =>
  lightboxIndex.value !== null ? allImages.value[lightboxIndex.value] ?? null : null
);

function openLightbox(src: string) {
  const idx = allImages.value.indexOf(src);
  lightboxIndex.value = idx >= 0 ? idx : 0;
}

function closeLightbox() { lightboxIndex.value = null; }

function lightboxPrev() {
  if (lightboxIndex.value === null) return;
  lightboxIndex.value = (lightboxIndex.value - 1 + allImages.value.length) % allImages.value.length;
}

function lightboxNext() {
  if (lightboxIndex.value === null) return;
  lightboxIndex.value = (lightboxIndex.value + 1) % allImages.value.length;
}

// Swipe support
let touchStartX = 0;
let touchStartY = 0;
function onTouchStart(e: TouchEvent) {
  touchStartX = e.touches[0]?.clientX ?? 0;
  touchStartY = e.touches[0]?.clientY ?? 0;
}
function onTouchEnd(e: TouchEvent) {
  const dx = (e.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
  const dy = (e.changedTouches[0]?.clientY ?? touchStartY) - touchStartY;
  // only count as horizontal swipe (not a vertical scroll attempt)
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
    dx < 0 ? lightboxNext() : lightboxPrev();
  }
}

// Click on left/right half of image area for navigation
function onImageAreaClick(e: MouseEvent) {
  if (allImages.value.length <= 1) return;
  const target = e.currentTarget as HTMLElement;
  const clickX = e.clientX - target.getBoundingClientRect().left;
  clickX < target.offsetWidth / 2 ? lightboxPrev() : lightboxNext();
}

const reportingKey = ref<string | null>(null);
const reportedIds = ref<Set<string>>(new Set());

const actingKey = ref<string | null>(null);
const likingId = ref<string | null>(null);

const pendingDelete = ref<{ type: "thread"; id: string } | { type: "comment"; id: string } | null>(null);
// Separate pending state for moderator DELETE (uses moderation/actions API)
const pendingModDelete = ref<{ targetType: "THREAD" | "COMMENT"; targetId: string } | null>(null);

const auth = useAuthStore();
const hasMod = computed(() => auth.isModerator);

function fmt(s: string) {
  return new Date(s).toLocaleString(undefined, {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    timeZoneName: "short",
  });
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    thread.value = await apiFetch<ThreadDto>(`/api/v1/threads/${threadId.value}`);
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : String(e);
    thread.value = null;
  } finally {
    loading.value = false;
  }
}

async function silentPoll() {
  if (posting.value || !thread.value) return;
  try {
    const fresh = await apiFetch<ThreadDto>(`/api/v1/threads/${threadId.value}`);
    if (thread.value && fresh.comments.length !== thread.value.comments.length) {
      thread.value.comments = fresh.comments;
    }
  } catch { /* ignore poll errors */ }
}

function handleCommentImagePick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) {
    toast.push("error", "Image must be under 3 MB");
    (e.target as HTMLInputElement).value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => { commentImageUrl.value = reader.result as string; };
  reader.readAsDataURL(file);
}

async function postComment() {
  if (!thread.value) return;
  const body = commentBody.value.trim();
  if (!body) return;

  posting.value = true;
  try {
    await apiFetch(`/api/v1/threads/${thread.value.id}/comments`, {
      method: "POST",
      body: JSON.stringify({ body, imageUrl: commentImageUrl.value }),
    });
    commentBody.value = "";
    commentImageUrl.value = null;
    toast.push("success", "Comment posted");
    await load();
    window.setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), 50);
  } catch (e) {
    toast.push("error", e instanceof ApiError ? e.message : "Failed to post comment");
  } finally {
    posting.value = false;
  }
}

const commentTextarea = ref<HTMLTextAreaElement | null>(null);

function replyTo(publicName: string) {
  const mention = `@${publicName} `;
  if (!commentBody.value.includes(mention)) {
    commentBody.value = mention + commentBody.value;
  }
  commentTextarea.value?.focus();
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}

async function toggleLike(commentId: string) {
  if (!auth.isLoggedIn) {
    toast.push("error", "You need to be logged in to react.");
    return;
  }
  if (likingId.value) return;
  likingId.value = commentId;
  try {
    const result = await apiFetch<{ liked: boolean; count: number }>(
      `/api/v1/comments/${commentId}/reactions`,
      { method: "POST", body: JSON.stringify({ type: "LIKE" }) },
    );
    // Update in-place without full reload for snappy UX
    if (thread.value) {
      const c = thread.value.comments.find((x) => x.id === commentId);
      if (c) {
        c.iLiked = result.liked;
        c.likeCount = result.count;
      }
    }
  } catch (e) {
    toast.push("error", e instanceof ApiError ? e.message : "Failed to react");
  } finally {
    likingId.value = null;
  }
}

async function submitReport(
  targetType: "THREAD" | "COMMENT",
  targetId: string,
  reason: "spam" | "abuse"
) {
  if (reportingKey.value) return;
  if (reportedIds.value.has(targetId)) return;

  reportingKey.value = targetId;

  const label = reason === "spam" ? "Spam" : "Abuse";
  const apiReason = reason === "spam" ? "SPAM" : "ABUSE";

  try {
    await apiFetch("/api/v1/reports", {
      method: "POST",
      body: JSON.stringify({ targetType, targetId, reason: apiReason }),
    });
    reportedIds.value.add(targetId);
    toast.push("success", `Report submitted: ${label}`);
  } catch (e) {
    toast.push("error", e instanceof ApiError ? e.message : `Report failed (${label})`);
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
    toast.push("error", "Moderator access required.");
    return;
  }

  // DELETE always shows a confirmation modal first
  if (actionType === "DELETE") {
    pendingModDelete.value = { targetType, targetId };
    return;
  }

  await executeModAct(targetType, targetId, actionType);
}

async function executeModAct(
  targetType: "THREAD" | "COMMENT",
  targetId: string,
  actionType: "HIDE" | "DELETE"
) {
  const key = `${actionType}:${targetType}:${targetId}`;
  if (actingKey.value) return;
  actingKey.value = key;

  try {
    await apiFetch("/api/v1/moderation/actions", {
      method: "POST",
      body: JSON.stringify({ actionType, targetType, targetId, note: "" }),
    });

    toast.push("success", `${actionType} applied`);
    if (actionType === "DELETE" && targetType === "THREAD") {
      await router.push(`/courses/${thread.value?.courseId}`);
    } else {
      await load();
    }
  } catch (e) {
    toast.push("error", e instanceof ApiError ? e.message : "Action failed");
  } finally {
    actingKey.value = null;
  }
}

async function confirmModDelete() {
  if (!pendingModDelete.value) return;
  const { targetType, targetId } = pendingModDelete.value;
  pendingModDelete.value = null;
  await executeModAct(targetType, targetId, "DELETE");
}

function confirmDeleteThread() {
  if (!thread.value?.isMine) return;
  pendingDelete.value = { type: "thread", id: thread.value.id };
}

function confirmDeleteComment(commentId: string) {
  const c = thread.value?.comments.find((x) => x.id === commentId);
  if (!c?.isMine) return;
  pendingDelete.value = { type: "comment", id: commentId };
}

async function executeDelete() {
  const target = pendingDelete.value;
  pendingDelete.value = null;
  if (!target) return;

  try {
    if (target.type === "thread") {
      const courseId = thread.value?.courseId;
      await apiFetch(`/api/v1/threads/${target.id}`, { method: "DELETE" });
      toast.push("success", "Thread deleted");
      await router.push(`/courses/${courseId}`);
    } else {
      await apiFetch(`/api/v1/comments/${target.id}`, { method: "DELETE" });
      toast.push("success", "Comment deleted");
      await load();
    }
  } catch (e) {
    toast.push("error", e instanceof ApiError ? e.message : "Delete failed");
  }
}

const backTo = computed(() => {
  if (thread.value) return `/courses/${thread.value.courseId}`;
  return "/courses";
});

onMounted(() => {
  load();
  pollInterval = setInterval(silentPoll, 5000);
});

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval);
});
</script>

<template>
  <div>
    <ConfirmModal
      v-if="pendingDelete"
      :title="pendingDelete.type === 'thread' ? 'Delete thread?' : 'Delete comment?'"
      :message="pendingDelete.type === 'thread'
        ? 'This thread and all its comments will be hidden. This cannot be undone.'
        : 'This comment will be hidden. This cannot be undone.'"
      confirm-label="Delete"
      :danger="true"
      @confirm="executeDelete"
      @cancel="pendingDelete = null"
    />

    <ConfirmModal
      v-if="pendingModDelete"
      :title="pendingModDelete.targetType === 'THREAD' ? 'Delete thread? (Moderator)' : 'Delete comment? (Moderator)'"
      message="This will permanently delete the content. This cannot be undone."
      confirm-label="Delete"
      :danger="true"
      @confirm="confirmModDelete"
      @cancel="pendingModDelete = null"
    />

    <div class="asku-subheader">
      <router-link class="asku-back" :to="backTo">← Back to Threads</router-link>
      <div class="asku-section-title">Thread</div>
    </div>

    <div v-if="loading" class="asku-muted mt-4">Loading…</div>
    <div v-if="error" class="asku-error mt-4">{{ error }}</div>

    <div v-if="thread" class="flex flex-col gap-6 mt-4 pb-56">
      <UiCard>
        <div class="asku-card-pad">
          <div class="flex flex-wrap items-start justify-between gap-2 sm:gap-6">
            <div class="text-xl sm:text-3xl font-semibold flex-1 min-w-0">{{ thread.title }}</div>
            <div class="asku-date">{{ fmt(thread.createdAt) }}</div>
          </div>

          <div class="asku-meta mt-2">
            <PseudonymBadge :pseudonym-id="thread.author.pseudonymId" :public-name="thread.author.publicName" />
            · {{ thread.status }}
          </div>

          <div class="asku-body mt-4">
            {{ thread.body }}
          </div>

          <div v-if="thread.imageUrl" class="mt-4">
            <button type="button" class="block p-0 border-0 bg-transparent" @click="openLightbox(thread!.imageUrl!)">
              <img :src="thread.imageUrl" alt="attached image" class="asku-img-display" />
            </button>
          </div>

          <div class="flex items-center justify-end gap-2 mt-6">
            <ReportMenu
              :disabled="reportingKey === thread.id"
              :reported="reportedIds.has(thread.id)"
              @select="(reason) => submitReport('THREAD', thread!.id, reason)"
            />

            <!-- Author delete — only shown when no mod tools available -->
            <button
              v-if="thread.isMine && !hasMod"
              class="inline-flex items-center rounded-lg bg-red-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-red-500"
              @click="confirmDeleteThread"
            >
              Delete
            </button>

            <!-- Mod tools — hide author delete to avoid duplication -->
            <template v-if="hasMod">
              <button
                class="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                :disabled="!!actingKey"
                @click="modAct('THREAD', thread.id, 'HIDE')"
              >
                {{ actingKey === `HIDE:THREAD:${thread.id}` ? "Working..." : "Hide" }}
              </button>
              <button
                class="inline-flex items-center rounded-lg bg-red-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-red-500 disabled:opacity-60"
                :disabled="!!actingKey"
                @click="modAct('THREAD', thread.id, 'DELETE')"
              >
                {{ actingKey === `DELETE:THREAD:${thread.id}` ? "Working..." : "Delete" }}
              </button>
            </template>
          </div>

          <div v-if="hasMod" class="text-xs text-slate-500 mt-2">
            Moderator tools enabled.
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
                <div class="flex flex-wrap items-start justify-between gap-1 sm:gap-6">
                  <div class="asku-meta !mt-0">
                    <PseudonymBadge :pseudonym-id="c.author.pseudonymId" :public-name="c.author.publicName" />
                  </div>
                  <div class="asku-date">{{ fmt(c.createdAt) }}</div>
                </div>

                <div class="asku-body mt-2">
                  {{ c.body }}
                </div>

                <div v-if="c.imageUrl" class="mt-3">
                  <button type="button" class="block p-0 border-0 bg-transparent" @click="openLightbox(c.imageUrl!)">
                    <img :src="c.imageUrl" alt="attached image" class="asku-img-display" />
                  </button>
                </div>

                <div class="flex items-center justify-between mt-4">
                  <!-- Left: like + reply -->
                  <div class="flex items-center gap-2">
                    <!-- Like button -->
                    <button
                      class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60"
                      :class="c.iLiked
                        ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'"
                      :disabled="likingId === c.id"
                      :title="c.iLiked ? 'Remove like' : 'Like this comment'"
                      @click="toggleLike(c.id)"
                    >
                      {{ c.iLiked ? 'Liked' : 'Like' }}<template v-if="c.likeCount > 0"> · {{ c.likeCount }}</template>
                    </button>

                    <!-- Reply button -->
                    <button
                      class="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                      @click="replyTo(c.author.publicName)"
                    >
                      Reply
                    </button>
                  </div>

                  <!-- Right: report + mod/delete actions -->
                  <div class="flex items-center gap-2">
                    <ReportMenu
                      :disabled="reportingKey === c.id"
                      :reported="reportedIds.has(c.id)"
                      @select="(reason) => submitReport('COMMENT', c.id, reason)"
                    />

                    <!-- Author delete — only when no mod tools -->
                    <button
                      v-if="c.isMine && !hasMod"
                      class="inline-flex items-center rounded-lg bg-red-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-red-500"
                      @click="confirmDeleteComment(c.id)"
                    >
                      Delete
                    </button>

                    <!-- Mod tools -->
                    <template v-if="hasMod">
                      <button
                        class="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        :disabled="!!actingKey"
                        @click="modAct('COMMENT', c.id, 'HIDE')"
                      >
                        {{ actingKey === `HIDE:COMMENT:${c.id}` ? "Working..." : "Hide" }}
                      </button>
                      <button
                        class="inline-flex items-center rounded-lg bg-red-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-red-500 disabled:opacity-60"
                        :disabled="!!actingKey"
                        @click="modAct('COMMENT', c.id, 'DELETE')"
                      >
                        {{ actingKey === `DELETE:COMMENT:${c.id}` ? "Working..." : "Delete" }}
                      </button>
                    </template>
                  </div>
                </div>
              </div>
            </UiCard>
          </div>
        </div>
      </UiCard>

    </div>
  </div>

  <!-- Fullscreen gallery lightbox -->
  <Teleport to="body">
    <div
      v-if="lightboxSrc"
      class="fixed inset-0 z-[999] flex flex-col bg-black select-none"
      style="touch-action: none; padding-bottom: env(safe-area-inset-bottom);"
      @touchstart="onTouchStart"
      @touchend="onTouchEnd"
    >
      <!-- Top bar -->
      <div class="flex items-center justify-between px-4 py-3 shrink-0" style="padding-top: max(12px, env(safe-area-inset-top))">
        <button
          class="flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-white text-sm font-medium active:bg-white/30"
          @click="closeLightbox"
        >
          ← Back
        </button>
        <div v-if="allImages.length > 1" class="text-white/70 text-sm">
          {{ (lightboxIndex ?? 0) + 1 }} / {{ allImages.length }}
        </div>
        <div class="w-20" />
      </div>

      <!-- Image — click left half = prev, right half = next -->
      <div
        class="flex-1 flex items-center justify-center overflow-hidden px-2"
        :class="allImages.length > 1 ? 'cursor-pointer' : ''"
        @click="onImageAreaClick"
      >
        <img
          :src="lightboxSrc"
          :key="lightboxIndex ?? 0"
          alt="full size"
          class="max-h-full max-w-full object-contain rounded-xl pointer-events-none"
        />
      </div>

      <!-- Prev / Next buttons -->
      <div v-if="allImages.length > 1" class="flex justify-between px-4 shrink-0 gap-3" style="padding-top: 16px; padding-bottom: max(16px, env(safe-area-inset-bottom))">
        <button
          class="flex-1 rounded-xl bg-white/15 py-3 text-white text-sm font-medium active:bg-white/30"
          @click="lightboxPrev"
        >
          ← Prev
        </button>
        <!-- Dot indicators -->
        <div class="flex items-center gap-1.5">
          <div
            v-for="(_, i) in allImages"
            :key="i"
            class="rounded-full transition-all"
            :class="i === lightboxIndex ? 'w-2.5 h-2.5 bg-white' : 'w-1.5 h-1.5 bg-white/40'"
          />
        </div>
        <button
          class="flex-1 rounded-xl bg-white/15 py-3 text-white text-sm font-medium active:bg-white/30"
          @click="lightboxNext"
        >
          Next →
        </button>
      </div>
      <div v-else style="padding-bottom: max(24px, env(safe-area-inset-bottom))" />
    </div>
  </Teleport>

  <!-- Fixed comment bar — always visible at the bottom of the screen -->
  <div v-if="thread" class="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
    <div class="max-w-5xl mx-auto px-4 py-3 sm:px-6">
      <div class="flex items-end gap-3">
        <div class="flex-1 flex flex-col gap-2">
          <textarea
            ref="commentTextarea"
            v-model="commentBody"
            class="asku-textarea !py-2 resize-none"
            rows="2"
            placeholder="Write a comment…"
            @focus="($el as HTMLTextAreaElement).rows = 4"
            @blur="!commentBody && (($el as HTMLTextAreaElement).rows = 2)"
          />
          <div class="flex items-center gap-3">
            <label class="asku-img-upload-label !py-1 !px-3 text-xs">
              {{ commentImageUrl ? 'Change photo' : 'Add photo' }}
              <input type="file" accept="image/*" class="sr-only" @change="handleCommentImagePick" />
            </label>
            <div v-if="commentImageUrl" class="relative inline-block">
              <img :src="commentImageUrl" alt="preview" class="h-10 w-10 rounded-lg border border-slate-200 object-cover" />
              <button type="button" class="asku-img-remove" @click="commentImageUrl = null">✕</button>
            </div>
            <!-- Hide keyboard button -->
            <button
              type="button"
              class="ml-auto rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500 active:bg-slate-100"
              @click="commentTextarea?.blur()"
            >
              Hide keyboard
            </button>
          </div>
        </div>
        <button
          class="asku-btn self-end"
          :disabled="posting || !commentBody.trim()"
          @click="postComment"
        >
          {{ posting ? "Posting..." : "Post" }}
        </button>
      </div>
    </div>
  </div>
</template>