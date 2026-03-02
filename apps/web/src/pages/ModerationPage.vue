<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import UiCard from "../components/UiCard.vue";
import { apiFetch } from "../api/client";
import { useToast } from "../composables/useToast";

type ReportItem = {
  id: string;
  createdAt: string;
  reporter: { publicName: string };
  courseId: string;
  targetType: "THREAD" | "COMMENT";
  targetId: string;
  reason: string;
  status: string;
};

const toast = useToast();

const keyInput = ref(localStorage.getItem("ASKU_MOD_KEY") ?? "");
const modKey = computed(() => keyInput.value.trim());

const loading = ref(false);
const error = ref<string | null>(null);
const reports = ref<ReportItem[]>([]);

const actingId = ref<string | null>(null);

function fmt(s: string) {
  return new Date(s).toLocaleString();
}

function saveKey() {
  localStorage.setItem("ASKU_MOD_KEY", keyInput.value.trim());
  toast.push("success", "Moderator key saved");
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    reports.value = await apiFetch<ReportItem[]>("/api/v1/moderation/reports", {
      headers: { "x-mod-key": modKey.value },
    });
  } catch (e) {
    error.value = String(e);
  } finally {
    loading.value = false;
  }
}

async function act(report: ReportItem, actionType: "HIDE" | "DELETE") {
  if (actingId.value) return;
  actingId.value = report.id;

  try {
    await apiFetch("/api/v1/moderation/actions", {
      method: "POST",
      headers: { "x-mod-key": modKey.value },
      body: JSON.stringify({
        reportId: report.id,
        actionType,
        targetType: report.targetType,
        targetId: report.targetId,
        note: "",
      }),
    });

    toast.push("success", `Action applied: ${actionType}`);
    await load();
  } catch (e) {
    toast.push("error", `Action failed: ${String(e)}`);
  } finally {
    actingId.value = null;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="asku-subheader">
      <router-link class="asku-back" to="/courses">← Courses</router-link>
      <div class="asku-section-title">Moderation</div>
    </div>

    <UiCard :topbar="false">
      <div class="asku-card-pad">
        <div class="text-xl font-semibold mb-2">Moderator access</div>
        <div class="text-sm text-slate-500 mb-4">
          Enter MOD_KEY (from API .env). Stored locally in your browser.
        </div>

        <div class="flex gap-3 items-center">
          <input v-model="keyInput" class="asku-input" placeholder="MOD_KEY" />
          <button class="asku-btn" :disabled="!modKey" @click="saveKey">Save</button>
          <button class="asku-btn-ghost" :disabled="!modKey" @click="load">Reload</button>
        </div>

        <div v-if="error" class="asku-error mt-4">{{ error }}</div>
      </div>
    </UiCard>

    <div v-if="loading" class="asku-muted mt-4">Loading…</div>

    <div v-if="!loading && !error" class="flex flex-col gap-4 mt-4">
      <UiCard v-for="r in reports" :key="r.id">
        <div class="asku-card-pad">
          <div class="flex items-start justify-between gap-6">
            <div class="text-lg font-semibold">
              {{ r.targetType }} · {{ r.reason }}
            </div>
            <div class="asku-date">{{ fmt(r.createdAt) }}</div>
          </div>

          <div class="asku-meta mt-2">
            Reporter: {{ r.reporter.publicName }} · Course: {{ r.courseId }} · Status: {{ r.status }}
          </div>

          <div class="text-sm text-slate-600 mt-2">
            Target ID: {{ r.targetId }}
          </div>

          <div class="flex justify-end gap-3 mt-4">
            <button class="asku-btn-ghost" :disabled="actingId === r.id" @click="act(r, 'HIDE')">
              {{ actingId === r.id ? "Working..." : "Hide" }}
            </button>
            <button class="asku-btn" :disabled="actingId === r.id" @click="act(r, 'DELETE')">
              {{ actingId === r.id ? "Working..." : "Delete" }}
            </button>
          </div>
        </div>
      </UiCard>

      <div v-if="reports.length === 0" class="asku-muted">
        No open reports 🎉
      </div>
    </div>
  </div>
</template>