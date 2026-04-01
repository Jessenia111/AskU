<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useRouter } from "vue-router";
import { apiFetch, ApiError } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { useToast } from "../composables/useToast";
import UiCard from "../components/UiCard.vue";

type PseudonymEntry = {
  courseId: string;
  courseCode: string;
  courseTitle: string;
  courseSemester: string;
  publicName: string;
};

const regeneratingId = ref<string | null>(null);

const auth = useAuthStore();
const router = useRouter();
const toast = useToast();

const pseudonyms = ref<PseudonymEntry[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const savingMode = ref(false);
const selectedMode = ref<"ANONYMOUS" | "REAL_NAME">(
  (auth.user?.displayMode as "ANONYMOUS" | "REAL_NAME") ?? "ANONYMOUS"
);

const modeChanged = computed(
  () => selectedMode.value !== (auth.user?.displayMode ?? "ANONYMOUS")
);

/** Derive display name from email — same logic as backend. */
const derivedName = computed(() => {
  const email = auth.user?.email ?? "";
  const local = email.split("@")[0] ?? "";
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  const parts = local.split(".").filter(Boolean).slice(0, 2);
  return parts.map(capitalize).join(" ") || local;
});

async function saveDisplayMode() {
  savingMode.value = true;
  try {
    await apiFetch("/api/v1/me/display-mode", {
      method: "PATCH",
      body: JSON.stringify({ displayMode: selectedMode.value }),
    });
    await auth.refresh();
    selectedMode.value = auth.user?.displayMode as "ANONYMOUS" | "REAL_NAME" ?? "ANONYMOUS";
    toast.push("success", "Display mode updated. Your pseudonyms will update on next course visit.");
  } catch (e) {
    toast.push("error", e instanceof ApiError ? e.message : "Failed to update");
  } finally {
    savingMode.value = false;
  }
}

async function regenerate(courseId: string) {
  if (regeneratingId.value) return;
  regeneratingId.value = courseId;
  try {
    const result = await apiFetch<{ publicName: string }>(
      `/api/v1/courses/${courseId}/my-pseudonym/regenerate`,
      { method: "POST" },
    );
    const entry = pseudonyms.value.find((p) => p.courseId === courseId);
    if (entry) entry.publicName = result.publicName;
    toast.push("success", `New pseudonym: ${result.publicName}`);
  } catch (e) {
    toast.push("error", e instanceof ApiError ? e.message : "Failed to regenerate");
  } finally {
    regeneratingId.value = null;
  }
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    pseudonyms.value = await apiFetch<PseudonymEntry[]>("/api/v1/me/pseudonyms");
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="asku-subheader">
      <button class="asku-back" @click="router.back()">← Back</button>
      <div class="asku-section-title">My Profile</div>
    </div>

    <!-- Identity card -->
    <UiCard class="mt-4">
      <div class="asku-card-pad">
        <div class="flex items-center gap-4">
          <div
            class="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white"
          >
            {{ auth.initials }}
          </div>
          <div>
            <div class="text-lg font-semibold text-slate-800">{{ auth.user?.email }}</div>
            <div class="mt-0.5 text-sm text-slate-500">
              {{ auth.isModerator ? "Moderator · Student" : "Student" }}
            </div>
          </div>
        </div>
      </div>
    </UiCard>

    <!-- Display mode settings -->
    <UiCard :topbar="false" class="mt-4">
      <div class="asku-card-pad">
        <div class="text-lg font-semibold mb-1">How you appear to others</div>
        <p class="text-sm text-slate-500 mb-4 leading-relaxed">
          Choose how other students see you across all courses.
          Your pseudonym in all courses will update immediately when you save.
        </p>

        <div class="flex flex-col gap-3">
          <!-- Anonymous option -->
          <button
            class="w-full rounded-xl border-2 px-4 py-3 text-left transition-all"
            :class="selectedMode === 'ANONYMOUS'
              ? 'border-zinc-900 bg-zinc-50'
              : 'border-zinc-200 hover:border-zinc-400'"
            @click="selectedMode = 'ANONYMOUS'"
          >
            <div class="font-semibold text-zinc-900 text-sm">Anonymous (recommended)</div>
            <div class="text-sm text-zinc-500 mt-0.5">
              You appear as a random pseudonym that changes every 24 hours.
              Other students will not know who you are.
            </div>
          </button>

          <!-- Real name option -->
          <button
            class="w-full rounded-xl border-2 px-4 py-3 text-left transition-all"
            :class="selectedMode === 'REAL_NAME'
              ? 'border-zinc-900 bg-zinc-50'
              : 'border-zinc-200 hover:border-zinc-400'"
            @click="selectedMode = 'REAL_NAME'"
          >
            <div class="font-semibold text-zinc-900 text-sm">Use my real name</div>
            <div class="text-sm text-zinc-500 mt-0.5">
              You appear as <span class="font-semibold text-zinc-700">{{ derivedName }}</span>.
              All other students will see your real name on every post and comment.
            </div>
          </button>
        </div>

        <!-- Save button — only shown when mode has changed -->
        <div v-if="modeChanged" class="mt-4 flex justify-end">
          <button
            class="asku-btn"
            :disabled="savingMode"
            @click="saveDisplayMode"
          >
            {{ savingMode ? "Saving…" : "Save change" }}
          </button>
        </div>

        <p v-if="!modeChanged" class="text-xs text-slate-400 mt-3">
          Current mode:
          <span class="font-medium text-slate-600">
            {{ auth.user?.displayMode === 'REAL_NAME' ? 'Real name' : 'Anonymous' }}
          </span>
        </p>
      </div>
    </UiCard>

    <!-- Pseudonyms per course -->
    <div class="mt-6">
      <div class="text-xl font-semibold mb-3 px-1">Your identities per course</div>

      <div v-if="loading" class="asku-muted">Loading…</div>
      <div v-else-if="error" class="asku-error">{{ error }}</div>

      <div v-else-if="pseudonyms.length === 0" class="asku-muted">
        You haven't participated in any courses yet. Open a course, post a thread or comment, and
        your identity will appear here.
      </div>

      <div v-else class="flex flex-col gap-3">
        <UiCard v-for="p in pseudonyms" :key="p.courseId" :topbar="false">
          <div class="asku-card-pad flex items-center justify-between gap-4">
            <router-link :to="`/courses/${p.courseId}`" class="no-underline min-w-0">
              <div class="font-semibold text-slate-800">{{ p.courseCode }}</div>
              <div class="text-sm text-slate-500 mt-0.5">{{ p.courseTitle }}</div>
              <div class="text-xs text-slate-400 mt-1">{{ p.courseSemester }}</div>
            </router-link>

            <div class="flex flex-col items-end gap-2 shrink-0">
              <div class="text-right">
                <div class="text-xs text-slate-400 mb-1">You appear as</div>
                <span class="rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">
                  {{ p.publicName }}
                </span>
              </div>
              <!-- Regenerate button — only for anonymous mode -->
              <button
                v-if="auth.user?.displayMode !== 'REAL_NAME'"
                class="text-xs text-slate-400 hover:text-slate-700 underline decoration-dotted disabled:opacity-50"
                :disabled="regeneratingId === p.courseId"
                @click.prevent="regenerate(p.courseId)"
              >
                {{ regeneratingId === p.courseId ? 'Regenerating…' : 'Get new pseudonym' }}
              </button>
            </div>
          </div>
        </UiCard>
      </div>
    </div>
  </div>
</template>
