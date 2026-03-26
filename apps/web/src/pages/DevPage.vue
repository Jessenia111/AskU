<script setup lang="ts">
import { useAuthStore } from "../stores/auth";
import UiCard from "../components/UiCard.vue";

const auth = useAuthStore();
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
          <span :class="auth.isModerator ? 'text-green-700 font-semibold' : 'text-slate-500'">
            {{ auth.isModerator ? "Moderator" : "Student" }}
          </span>
        </div>
        <div v-if="!auth.isModerator" class="mt-3 text-xs text-slate-400">
          Moderator role is granted automatically on login if your email matches MODERATOR_EMAIL in .env
        </div>
      </div>
    </UiCard>
  </div>
</template>
