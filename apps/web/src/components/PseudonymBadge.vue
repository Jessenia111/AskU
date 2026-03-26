<script setup lang="ts">
import { ref } from "vue";
import { useAuthStore } from "../stores/auth";
import { apiFetch, ApiError } from "../api/client";

const props = defineProps<{
  pseudonymId: string;
  publicName: string;
}>();

const auth = useAuthStore();

const showModal = ref(false);
const email = ref<string | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

async function reveal() {
  if (!auth.isModerator) return;
  showModal.value = true;
  if (email.value) return; // already loaded
  loading.value = true;
  error.value = null;
  try {
    const data = await apiFetch<{ email: string }>(`/api/v1/pseudonyms/${props.pseudonymId}/identity`);
    email.value = data.email;
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : "Failed to load";
  } finally {
    loading.value = false;
  }
}

function close() {
  showModal.value = false;
}
</script>

<template>
  <!-- Moderator: clickable badge -->
  <button
    v-if="auth.isModerator"
    class="font-semibold text-slate-700 underline decoration-dotted underline-offset-2 hover:text-blue-700 cursor-pointer bg-transparent border-none p-0"
    @click.stop="reveal"
  >
    {{ publicName }}
  </button>

  <!-- Student: plain text, not clickable -->
  <span v-else class="font-semibold text-slate-700">{{ publicName }}</span>

  <!-- Identity modal -->
  <Teleport to="body">
    <div
      v-if="showModal"
      class="fixed inset-0 z-[200] flex items-center justify-center bg-black/40"
      @click.self="close"
    >
      <div class="bg-white rounded-2xl shadow-xl p-6 w-80 flex flex-col gap-3">
        <div class="text-lg font-semibold">Identity Lookup</div>
        <div class="text-sm text-slate-500">Pseudonym</div>
        <div class="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
          {{ publicName }}
        </div>
        <div class="text-sm text-slate-500">Real email</div>
        <div v-if="loading" class="text-sm text-slate-400">Loading…</div>
        <div v-else-if="error" class="text-sm text-red-600">{{ error }}</div>
        <div v-else class="rounded-lg bg-slate-100 px-3 py-2 text-sm font-mono text-slate-800 break-all">
          {{ email }}
        </div>
        <div class="text-xs text-slate-400 mt-1">
          This information is only visible to moderators and is logged for audit purposes.
        </div>
        <button class="asku-btn-ghost mt-1" @click="close">Close</button>
      </div>
    </div>
  </Teleport>
</template>
