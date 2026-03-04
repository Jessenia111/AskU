<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { apiFetch } from "../api/client";
import { useAuthStore } from "../stores/auth";
import UiCard from "../components/UiCard.vue";

type PseudonymEntry = {
  courseId: string;
  courseCode: string;
  courseTitle: string;
  courseSemester: string;
  publicName: string;
};

const auth = useAuthStore();
const router = useRouter();
const pseudonyms = ref<PseudonymEntry[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

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

    <!-- Anonymity info -->
    <UiCard :topbar="false" class="mt-4">
      <div class="asku-card-pad">
        <div class="text-lg font-semibold mb-2">About your anonymity</div>
        <p class="text-sm text-slate-600 leading-relaxed">
          AskU uses <strong>verified anonymity</strong>. Your real identity is never shown to other
          students or instructors. Instead, you appear under a unique random name for each course
          you participate in. Different courses give you different pseudonyms, so your activity
          across courses cannot be linked.
        </p>
      </div>
    </UiCard>

    <!-- Pseudonyms per course -->
    <div class="mt-6">
      <div class="text-xl font-semibold mb-3 px-1">Your anonymous identities</div>

      <div v-if="loading" class="asku-muted">Loading…</div>
      <div v-else-if="error" class="asku-error">{{ error }}</div>

      <div v-else-if="pseudonyms.length === 0" class="asku-muted">
        You haven't participated in any courses yet. Open a course, post a thread or comment, and
        your anonymous name will appear here.
      </div>

      <div v-else class="flex flex-col gap-3">
        <router-link
          v-for="p in pseudonyms"
          :key="p.courseId"
          :to="`/courses/${p.courseId}`"
          style="text-decoration: none"
        >
          <UiCard :topbar="false">
            <div class="asku-card-pad flex items-center justify-between gap-4">
              <div>
                <div class="font-semibold text-slate-800">{{ p.courseCode }}</div>
                <div class="text-sm text-slate-500 mt-0.5">{{ p.courseTitle }}</div>
                <div class="text-xs text-slate-400 mt-1">{{ p.courseSemester }}</div>
              </div>
              <div class="text-right shrink-0">
                <div class="text-xs text-slate-400 mb-1">You appear as</div>
                <span
                  class="rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700"
                >
                  {{ p.publicName }}
                </span>
              </div>
            </div>
          </UiCard>
        </router-link>
      </div>
    </div>
  </div>
</template>
