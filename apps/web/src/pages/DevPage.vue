<script setup lang="ts">
import { ref } from "vue";
import { apiFetch, ApiError } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { useToast } from "../composables/useToast";
import UiCard from "../components/UiCard.vue";

const auth = useAuthStore();
const toast = useToast();
const loading = ref(false);

async function makeModerator() {
  loading.value = true;
  try {
    await apiFetch("/api/v1/dev/make-moderator", { method: "POST" });
    await auth.refresh();
    toast.push("success", "You are now a Moderator. Refresh the page if needed.");
  } catch (e) {
    toast.push("error", e instanceof ApiError ? e.message : "Failed");
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div>
    <div class="asku-subheader">
      <div class="asku-section-title">Dev Tools</div>
    </div>

    <div class="mt-4 rounded-xl border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
      This page is only available in development mode and is not shown in production.
    </div>

    <UiCard :topbar="false" class="mt-4">
      <div class="asku-card-pad">
        <div class="text-lg font-semibold mb-1">Logged in as</div>
        <div class="text-slate-600 text-sm">{{ auth.user?.email ?? "—" }}</div>
        <div class="mt-1 text-sm">
          Role:
          <span
            :class="auth.isModerator
              ? 'text-green-700 font-semibold'
              : 'text-slate-500'"
          >
            {{ auth.isModerator ? "Moderator" : "Student" }}
          </span>
        </div>
      </div>
    </UiCard>

    <UiCard :topbar="false" class="mt-4">
      <div class="asku-card-pad">
        <div class="text-lg font-semibold mb-4">Grant Moderator Role</div>
        <button
          class="asku-btn"
          :disabled="loading || auth.isModerator"
          @click="makeModerator"
        >
          {{ auth.isModerator ? "Already a Moderator" : loading ? "Granting..." : "Make me Moderator" }}
        </button>
      </div>
    </UiCard>
  </div>
</template>
