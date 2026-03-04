<script setup lang="ts">
import { onMounted, ref } from "vue";
import UiCard from "../components/UiCard.vue";
import { apiFetch } from "../api/client";
import { useToast } from "../composables/useToast";
import { useAuthStore } from "../stores/auth";

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
const auth = useAuthStore();

const loading = ref(false);
const error = ref<string | null>(null);
const reports = ref<ReportItem[]>([]);

type Acting = { id: string; action: "HIDE" | "DELETE" | "DISMISS" };
const acting = ref<Acting | null>(null);

function isActing(id: string, action: Acting["action"]) {
  return acting.value?.id === id && acting.value?.action === action;
}
function anyActing(id: string) {
  return acting.value?.id === id;
}

function fmt(s: string) {
  return new Date(s).toLocaleString();
}

function labelReason(r: string) {
  if (r === "SPAM") return "Spam";
  if (r === "ABUSE") return "Abuse";
  return r;
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    reports.value = await apiFetch<ReportItem[]>("/api/v1/moderation/reports");
  } catch (e) {
    error.value = String(e);
  } finally {
    loading.value = false;
  }
}

async function act(report: ReportItem, actionType: "HIDE" | "DELETE") {
  if (acting.value) return;
  acting.value = { id: report.id, action: actionType };
  try {
    await apiFetch("/api/v1/moderation/actions", {
      method: "POST",
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
    acting.value = null;
  }
}

async function dismiss(report: ReportItem) {
  if (acting.value) return;
  acting.value = { id: report.id, action: "DISMISS" };
  try {
    await apiFetch("/api/v1/moderation/dismiss", {
      method: "POST",
      body: JSON.stringify({ reportId: report.id }),
    });
    toast.push("info", "Report dismissed");
    await load();
  } catch (e) {
    toast.push("error", `Dismiss failed: ${String(e)}`);
  } finally {
    acting.value = null;
  }
}

onMounted(() => {
  if (auth.isModerator) load();
});
</script>

<template>
  <div>
    <div class="asku-subheader">
      <router-link class="asku-back" to="/courses">← Courses</router-link>
      <div class="asku-section-title">Moderation</div>
    </div>

    <!-- Not a moderator -->
    <div v-if="!auth.isModerator">
      <UiCard :topbar="false">
        <div class="asku-card-pad text-center py-8">
          <div class="text-lg font-semibold text-slate-700">Access restricted</div>
          <div class="text-sm text-slate-500 mt-2">
            You need the Moderator role to access this panel.
          </div>
        </div>
      </UiCard>
    </div>

    <!-- Moderator view -->
    <div v-else>
      <div v-if="loading" class="asku-muted mt-4">Loading…</div>
      <div v-if="error" class="asku-error mt-4">{{ error }}</div>

      <div v-if="!loading && !error && reports.length === 0" class="asku-muted mt-4">
        No open reports.
      </div>

      <div v-if="!loading && reports.length > 0" class="flex flex-col gap-4 mt-4">
        <div class="text-sm text-slate-500 font-medium">
          {{ reports.length }} open {{ reports.length === 1 ? 'report' : 'reports' }}
        </div>

        <UiCard v-for="r in reports" :key="r.id">
          <div class="asku-card-pad">

            <div class="flex items-start justify-between gap-6">
              <div class="flex items-center gap-2">
                <span
                  class="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold"
                  :class="r.reason === 'SPAM' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'"
                >
                  {{ labelReason(r.reason) }}
                </span>
                <span class="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {{ r.targetType }}
                </span>
              </div>
              <div class="asku-date shrink-0">{{ fmt(r.createdAt) }}</div>
            </div>

            <div class="mt-2 text-sm text-slate-500">
              <span v-if="r.course">
                Course: <span class="font-medium text-slate-700">{{ r.course.code }} — {{ r.course.title }}</span>
              </span>
              <span v-else>Course: unknown</span>
              &nbsp;·&nbsp; Reported by: <span class="font-medium text-slate-700">{{ r.reporter.publicName }}</span>
            </div>

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

            <div class="flex justify-end gap-2 mt-4">
              <button
                class="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                :disabled="anyActing(r.id)"
                @click="dismiss(r)"
              >
                {{ isActing(r.id, 'DISMISS') ? "Dismissing..." : "Dismiss" }}
              </button>
              <button
                class="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                :disabled="anyActing(r.id)"
                @click="act(r, 'HIDE')"
              >
                {{ isActing(r.id, 'HIDE') ? "Hiding..." : "Hide" }}
              </button>
              <button
                class="inline-flex items-center rounded-lg bg-red-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-red-500 disabled:opacity-60"
                :disabled="anyActing(r.id)"
                @click="act(r, 'DELETE')"
              >
                {{ isActing(r.id, 'DELETE') ? "Deleting..." : "Delete" }}
              </button>
            </div>

          </div>
        </UiCard>
      </div>
    </div>
  </div>
</template>
