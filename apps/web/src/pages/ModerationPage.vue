<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import UiCard from "../components/UiCard.vue";
import { apiFetch } from "../api/client";
import { useToast } from "../composables/useToast";

type ReportItem = {
  id: string;
  createdAt: string;
  reporter: { publicName: string };
  course: { id: string; code: string; title: string } | null;
  targetType: "THREAD" | "COMMENT";
  targetId: string;
  reason: "SPAM" | "ABUSE" | string;
  status: string;
  contentTitle: string | null;
  contentPreview: string | null;
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

function labelReason(r: string) {
  if (r === "SPAM") return "Spam";
  if (r === "ABUSE") return "Abuse";
  return r;
}

function saveKey() {
  localStorage.setItem("ASKU_MOD_KEY", keyInput.value.trim());
  toast.push("success", "Moderator key saved");
}

async function load() {
  if (!modKey.value) {
    reports.value = [];
    error.value = "Enter MOD_KEY first.";
    return;
  }

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
  if (!modKey.value) { toast.push("error", "Missing MOD_KEY"); return; }
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
    toast.push("success", `${actionType === "HIDE" ? "Hidden" : "Deleted"} successfully`);
    await load();
  } catch (e) {
    toast.push("error", `Action failed: ${String(e)}`);
  } finally {
    actingId.value = null;
  }
}

async function dismiss(report: ReportItem) {
  if (!modKey.value) { toast.push("error", "Missing MOD_KEY"); return; }
  if (actingId.value) return;
  actingId.value = report.id;
  try {
    await apiFetch("/api/v1/moderation/dismiss", {
      method: "POST",
      headers: { "x-mod-key": modKey.value },
      body: JSON.stringify({ reportId: report.id }),
    });
    toast.push("info", "Report dismissed");
    await load();
  } catch (e) {
    toast.push("error", `Dismiss failed: ${String(e)}`);
  } finally {
    actingId.value = null;
  }
}

onMounted(() => {
  if (modKey.value) load();
});
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
          <input v-model="keyInput" class="asku-input" placeholder="MOD_KEY" type="password" />
          <button class="asku-btn" :disabled="!modKey" @click="saveKey">Save</button>
          <button class="asku-btn-ghost" :disabled="!modKey" @click="load">Load reports</button>
        </div>
        <div v-if="error" class="asku-error mt-4">{{ error }}</div>
      </div>
    </UiCard>

    <div v-if="loading" class="asku-muted mt-4">Loading…</div>

    <div v-if="!loading && reports.length === 0 && !error" class="asku-muted mt-4">
      No open reports.
    </div>

    <div v-if="!loading && reports.length > 0" class="flex flex-col gap-4 mt-4">
      <div class="text-sm text-slate-500 font-medium">
        {{ reports.length }} open {{ reports.length === 1 ? 'report' : 'reports' }}
      </div>

      <UiCard v-for="r in reports" :key="r.id">
        <div class="asku-card-pad">

          <!-- Header row -->
          <div class="flex items-start justify-between gap-6">
            <div class="flex items-center gap-2">
              <span
                class="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold"
                :class="r.reason === 'SPAM'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'"
              >
                {{ labelReason(r.reason) }}
              </span>
              <span class="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                {{ r.targetType }}
              </span>
            </div>
            <div class="asku-date shrink-0">{{ fmt(r.createdAt) }}</div>
          </div>

          <!-- Course info -->
          <div class="mt-2 text-sm text-slate-500">
            <span v-if="r.course">
              Course: <span class="font-medium text-slate-700">{{ r.course.code }} — {{ r.course.title }}</span>
            </span>
            <span v-else>Course: unknown</span>
            &nbsp;·&nbsp; Reported by: <span class="font-medium text-slate-700">{{ r.reporter.publicName }}</span>
          </div>

          <!-- Reported content -->
          <div class="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div v-if="r.contentTitle" class="font-semibold text-slate-800 mb-1">
              {{ r.contentTitle }}
            </div>
            <div v-if="r.contentPreview" class="text-sm text-slate-700 leading-relaxed">
              {{ r.contentPreview }}
            </div>
            <div v-else class="text-sm text-slate-400 italic">
              Content no longer available.
            </div>
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-2 mt-4">
            <button
              class="asku-btn-ghost text-sm"
              :disabled="actingId === r.id"
              @click="dismiss(r)"
            >
              Dismiss
            </button>
            <button
              class="asku-btn-ghost text-sm"
              :disabled="actingId === r.id"
              @click="act(r, 'HIDE')"
            >
              {{ actingId === r.id ? "Working..." : "Hide" }}
            </button>
            <button
              class="asku-btn-danger text-sm"
              :disabled="actingId === r.id"
              @click="act(r, 'DELETE')"
            >
              {{ actingId === r.id ? "Working..." : "Delete" }}
            </button>
          </div>

        </div>
      </UiCard>
    </div>
  </div>
</template>
