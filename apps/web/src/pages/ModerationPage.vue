<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import UiCard from "../components/UiCard.vue";
import PseudonymBadge from "../components/PseudonymBadge.vue";
import ConfirmModal from "../components/ConfirmModal.vue";
import { apiFetch, ApiError } from "../api/client";
import { useToast } from "../composables/useToast";
import { useAuthStore } from "../stores/auth";

// ─── types ────────────────────────────────────────────────────────────────────

type ReportItem = {
  id: string;
  createdAt: string;
  reporter: { pseudonymId: string; publicName: string };
  course: { id: string; code: string; title: string } | null;
  targetType: "THREAD" | "COMMENT";
  targetId: string;
  reason: "SPAM" | "ABUSE" | string;
  status: string;
  contentTitle: string | null;
  contentPreview: string | null;
  contentAuthorEmail: string | null;
  contentAuthorName: string | null;
};

type Course = { id: string; code: string; title: string; semester: string; createdAt: string };

type UserItem = {
  id: string;
  email: string;
  createdAt: string;
  displayMode: string | null;
  isModerator: boolean;
};

// ─── state ────────────────────────────────────────────────────────────────────

const toast = useToast();
const auth = useAuthStore();

type Tab = "reports" | "courses" | "users" | "audit";
const activeTab = ref<Tab>("reports");

// Reports
const loadingReports = ref(false);
const errorReports = ref<string | null>(null);
const reports = ref<ReportItem[]>([]);

type Acting = { id: string; action: "HIDE" | "DELETE" | "DISMISS" };
const acting = ref<Acting | null>(null);

// Courses
const loadingCourses = ref(false);
const errorCourses = ref<string | null>(null);
const courses = ref<Course[]>([]);
const showAddCourse = ref(false);
const newCourse = ref({ code: "", title: "", semester: "" });
const savingCourse = ref(false);
const pendingDeleteCourse = ref<Course | null>(null);

// Users
const loadingUsers = ref(false);
const errorUsers = ref<string | null>(null);

// Audit Log
type AuditEntry = {
  id: string;
  createdAt: string;
  actorEmail: string;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
};
const loadingAudit = ref(false);
const errorAudit = ref<string | null>(null);
const auditEntries = ref<AuditEntry[]>([]);
const users = ref<UserItem[]>([]);
const pendingDeleteUser = ref<UserItem | null>(null);
const actingUser = ref<string | null>(null);
const userSearch = ref("");

const filteredUsers = computed(() => {
  const q = userSearch.value.trim().toLowerCase();
  if (!q) return users.value;
  return users.value.filter((u) => u.email.toLowerCase().includes(q));
});

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(s: string) {
  return new Date(s).toLocaleString();
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString();
}
function labelReason(r: string) {
  if (r === "SPAM") return "Spam";
  if (r === "ABUSE") return "Abuse";
  return r;
}
function isActing(id: string, action: Acting["action"]) {
  return acting.value?.id === id && acting.value?.action === action;
}
function anyActing(id: string) {
  return acting.value?.id === id;
}

// ─── Reports ─────────────────────────────────────────────────────────────────

async function loadReports() {
  loadingReports.value = true;
  errorReports.value = null;
  try {
    reports.value = await apiFetch<ReportItem[]>("/api/v1/moderation/reports");
  } catch (e) {
    errorReports.value = e instanceof ApiError ? e.message : String(e);
  } finally {
    loadingReports.value = false;
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
    await loadReports();
  } catch (e) {
    toast.push("error", e instanceof ApiError ? e.message : `Action failed`);
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
    await loadReports();
  } catch (e) {
    toast.push("error", e instanceof ApiError ? e.message : `Dismiss failed`);
  } finally {
    acting.value = null;
  }
}

// ─── Courses ─────────────────────────────────────────────────────────────────

async function loadCourses() {
  loadingCourses.value = true;
  errorCourses.value = null;
  try {
    courses.value = await apiFetch<Course[]>("/api/v1/moderation/courses");
  } catch (e) {
    errorCourses.value = e instanceof ApiError ? e.message : String(e);
  } finally {
    loadingCourses.value = false;
  }
}

async function saveCourse() {
  const { code, title, semester } = newCourse.value;
  if (!code.trim() || !title.trim() || !semester.trim()) {
    toast.push("error", "Please fill in all fields");
    return;
  }
  savingCourse.value = true;
  try {
    await apiFetch("/api/v1/moderation/courses", {
      method: "POST",
      body: JSON.stringify({ code: code.trim(), title: title.trim(), semester: semester.trim() }),
    });
    toast.push("success", "Course created");
    newCourse.value = { code: "", title: "", semester: "" };
    showAddCourse.value = false;
    await loadCourses();
  } catch (e) {
    toast.push("error", e instanceof ApiError ? e.message : "Failed to create course");
  } finally {
    savingCourse.value = false;
  }
}

async function deleteCourse() {
  if (!pendingDeleteCourse.value) return;
  const id = pendingDeleteCourse.value.id;
  pendingDeleteCourse.value = null;
  try {
    await apiFetch(`/api/v1/moderation/courses/${id}`, { method: "DELETE" });
    toast.push("success", "Course deleted");
    await loadCourses();
  } catch (e) {
    toast.push("error", e instanceof ApiError ? e.message : "Failed to delete course");
  }
}

// ─── Users ────────────────────────────────────────────────────────────────────

async function loadUsers() {
  loadingUsers.value = true;
  errorUsers.value = null;
  try {
    users.value = await apiFetch<UserItem[]>("/api/v1/moderation/users");
  } catch (e) {
    errorUsers.value = e instanceof ApiError ? e.message : String(e);
  } finally {
    loadingUsers.value = false;
  }
}

async function deleteUser() {
  if (!pendingDeleteUser.value) return;
  const u = pendingDeleteUser.value;
  pendingDeleteUser.value = null;
  actingUser.value = u.id;
  try {
    await apiFetch(`/api/v1/moderation/users/${u.id}`, { method: "DELETE" });
    toast.push("success", `User ${u.email} deleted`);
    await loadUsers();
  } catch (e) {
    toast.push("error", e instanceof ApiError ? e.message : "Failed to delete user");
  } finally {
    actingUser.value = null;
  }
}

async function toggleModerator(u: UserItem) {
  actingUser.value = u.id;
  try {
    if (u.isModerator) {
      await apiFetch(`/api/v1/moderation/users/${u.id}/revoke-moderator`, { method: "DELETE" });
      toast.push("info", `Moderator removed from ${u.email}`);
    } else {
      await apiFetch(`/api/v1/moderation/users/${u.id}/grant-moderator`, { method: "POST" });
      toast.push("success", `${u.email} is now a moderator`);
    }
    await loadUsers();
  } catch (e) {
    toast.push("error", e instanceof ApiError ? e.message : "Failed to update role");
  } finally {
    actingUser.value = null;
  }
}

// ─── Audit Log ───────────────────────────────────────────────────────────────

async function loadAuditLog() {
  loadingAudit.value = true;
  errorAudit.value = null;
  try {
    auditEntries.value = await apiFetch<AuditEntry[]>("/api/v1/moderation/audit-log");
  } catch (e) {
    errorAudit.value = e instanceof ApiError ? e.message : String(e);
  } finally {
    loadingAudit.value = false;
  }
}

function describeEntry(entry: AuditEntry): { label: string; detail: string; color: string } {
  const meta = entry.metadata as Record<string, string> | null;
  const entity = entry.entityType ?? "";

  switch (entry.eventType) {
    case "MOD_ACTION": {
      const action = meta?.actionType === "DELETE" ? "Deleted" : "Hidden";
      const target = entity === "THREAD" ? "thread" : "comment";
      return {
        label: `${action} ${target}`,
        detail: meta?.reportId ? `Via report` : `Direct action`,
        color: meta?.actionType === "DELETE" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700",
      };
    }
    case "MOD_DISMISS":
      return { label: "Report dismissed", detail: `${entity}`, color: "bg-slate-100 text-slate-600" };
    case "REPORT_CREATED":
      return {
        label: "Report submitted",
        detail: `Reason: ${meta?.reason ?? "unknown"} · ${entity}`,
        color: "bg-yellow-100 text-yellow-700",
      };
    case "COURSE_CREATED":
      return { label: "Course created", detail: meta?.code ? `${meta.code} — ${meta.title ?? ""}` : "", color: "bg-green-100 text-green-700" };
    case "COURSE_DELETED":
      return { label: "Course deleted", detail: meta?.code ? `${meta.code} — ${meta.title ?? ""}` : "", color: "bg-red-100 text-red-700" };
    case "USER_DELETED":
      return { label: "User deleted", detail: meta?.email ?? "", color: "bg-red-100 text-red-700" };
    case "THREAD_HIDDEN_BY_AUTHOR":
      return { label: "Thread hidden by author", detail: "", color: "bg-slate-100 text-slate-600" };
    case "COMMENT_HIDDEN_BY_AUTHOR":
      return { label: "Comment hidden by author", detail: "", color: "bg-slate-100 text-slate-600" };
    case "IDENTITY_LOOKUP":
      return { label: "Identity lookup", detail: "Moderator revealed identity behind a pseudonym", color: "bg-purple-100 text-purple-700" };
    default:
      return { label: entry.eventType.replace(/_/g, " ").toLowerCase(), detail: "", color: "bg-slate-100 text-slate-600" };
  }
}

// ─── Tab switching ────────────────────────────────────────────────────────────

function switchTab(tab: Tab) {
  activeTab.value = tab;
  if (tab === "reports" && reports.value.length === 0) loadReports();
  if (tab === "courses" && courses.value.length === 0) loadCourses();
  if (tab === "users" && users.value.length === 0) loadUsers();
  if (tab === "audit" && auditEntries.value.length === 0) loadAuditLog();
}

onMounted(() => {
  if (auth.isModerator) loadReports();
});
</script>

<template>
  <div>
    <!-- Confirm delete course -->
    <ConfirmModal
      v-if="pendingDeleteCourse"
      title="Delete course?"
      :message="`Delete '${pendingDeleteCourse.code} — ${pendingDeleteCourse.title}'? All threads and comments in this course will be permanently deleted.`"
      confirm-label="Delete"
      :danger="true"
      @confirm="deleteCourse"
      @cancel="pendingDeleteCourse = null"
    />

    <!-- Confirm delete user -->
    <ConfirmModal
      v-if="pendingDeleteUser"
      title="Delete user?"
      :message="`Delete account for '${pendingDeleteUser.email}'? All their content will remain but their account will be removed.`"
      confirm-label="Delete"
      :danger="true"
      @confirm="deleteUser"
      @cancel="pendingDeleteUser = null"
    />

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
      <!-- Tabs -->
      <div class="flex gap-1 mt-4 border-b border-slate-200">
        <button
          v-for="tab in (['reports', 'courses', 'users', 'audit'] as const)"
          :key="tab"
          class="px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors capitalize"
          :class="activeTab === tab
            ? 'bg-white border border-b-white border-slate-200 text-slate-900 -mb-px'
            : 'text-slate-500 hover:text-slate-800'"
          @click="switchTab(tab)"
        >
          {{ tab === 'reports' ? `Reports${reports.length ? ` (${reports.length})` : ''}` : tab === 'audit' ? 'Audit Log' : tab.charAt(0).toUpperCase() + tab.slice(1) }}
        </button>
      </div>

      <!-- ── Reports tab ─────────────────────────────────────────────────── -->
      <div v-if="activeTab === 'reports'" class="mt-4">
        <div v-if="loadingReports" class="asku-muted">Loading…</div>
        <div v-if="errorReports" class="asku-error">{{ errorReports }}</div>

        <div v-if="!loadingReports && !errorReports && reports.length === 0" class="asku-muted">
          No open reports.
        </div>

        <div v-if="!loadingReports && reports.length > 0" class="flex flex-col gap-4">
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
                &nbsp;·&nbsp; Reported by: <PseudonymBadge :pseudonym-id="r.reporter.pseudonymId" :public-name="r.reporter.publicName" />
              </div>

              <!-- Author email (shown to moderator) -->
              <div v-if="r.contentAuthorEmail" class="mt-1.5 text-xs text-slate-400">
                Written by:
                <span class="font-mono text-slate-600 font-medium">{{ r.contentAuthorEmail }}</span>
                <span v-if="r.contentAuthorName" class="text-slate-400"> ({{ r.contentAuthorName }})</span>
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

      <!-- ── Courses tab ─────────────────────────────────────────────────── -->
      <div v-if="activeTab === 'courses'" class="mt-4">
        <div v-if="loadingCourses" class="asku-muted">Loading…</div>
        <div v-if="errorCourses" class="asku-error">{{ errorCourses }}</div>

        <!-- Add course button -->
        <div class="flex justify-end mb-4">
          <button class="asku-btn" @click="showAddCourse = !showAddCourse">
            {{ showAddCourse ? 'Cancel' : '+ Add Course' }}
          </button>
        </div>

        <!-- Add course form -->
        <UiCard v-if="showAddCourse" :topbar="false" class="mb-4">
          <div class="asku-card-pad">
            <div class="text-lg font-semibold mb-4">New course</div>
            <div class="flex flex-col gap-3">
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Course code</label>
                <input
                  v-model="newCourse.code"
                  class="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                  placeholder="e.g. LTAT.04.004"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Course title</label>
                <input
                  v-model="newCourse.title"
                  class="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                  placeholder="e.g. Software Engineering"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 mb-1">Semester</label>
                <input
                  v-model="newCourse.semester"
                  class="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/10"
                  placeholder="e.g. Spring 2026"
                />
              </div>
              <div class="flex justify-end gap-2 mt-2">
                <button class="asku-btn-ghost" @click="showAddCourse = false">Cancel</button>
                <button class="asku-btn" :disabled="savingCourse" @click="saveCourse">
                  {{ savingCourse ? 'Creating…' : 'Create course' }}
                </button>
              </div>
            </div>
          </div>
        </UiCard>

        <!-- Course list -->
        <div v-if="!loadingCourses && courses.length === 0 && !errorCourses" class="asku-muted">
          No courses yet. Add the first one above.
        </div>

        <div v-if="!loadingCourses && courses.length > 0" class="flex flex-col gap-3">
          <UiCard v-for="c in courses" :key="c.id" :topbar="false">
            <div class="asku-card-pad flex items-center justify-between gap-4">
              <div>
                <div class="font-bold text-blue-700">{{ c.code }}</div>
                <div class="text-slate-700">{{ c.title }}</div>
                <div class="text-xs text-slate-400 mt-0.5">{{ c.semester }} · Added {{ fmtDate(c.createdAt) }}</div>
              </div>
              <button
                class="inline-flex items-center rounded-lg bg-red-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-red-500 shrink-0"
                @click="pendingDeleteCourse = c"
              >
                Delete
              </button>
            </div>
          </UiCard>
        </div>
      </div>

      <!-- ── Users tab ───────────────────────────────────────────────────── -->
      <div v-if="activeTab === 'users'" class="mt-4">
        <div v-if="loadingUsers" class="asku-muted">Loading…</div>
        <div v-if="errorUsers" class="asku-error">{{ errorUsers }}</div>

        <div v-if="!loadingUsers && users.length > 0">
          <!-- Search -->
          <input
            v-model="userSearch"
            class="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm mb-4 outline-none focus:ring-2 focus:ring-zinc-900/10"
            placeholder="Search by email…"
          />

          <div class="text-sm text-slate-500 mb-2 font-medium">
            {{ filteredUsers.length }} user{{ filteredUsers.length === 1 ? '' : 's' }}
          </div>

          <div class="flex flex-col gap-2">
            <UiCard v-for="u in filteredUsers" :key="u.id" :topbar="false">
              <div class="asku-card-pad flex items-center justify-between gap-4">
                <div class="min-w-0">
                  <div class="font-mono text-sm text-slate-800 truncate">{{ u.email }}</div>
                  <div class="flex items-center gap-2 mt-1 flex-wrap">
                    <span
                      v-if="u.isModerator"
                      class="inline-flex items-center rounded-lg bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700"
                    >
                      Moderator
                    </span>
                    <span class="text-xs text-slate-400">
                      {{ u.displayMode === 'REAL_NAME' ? 'Real name' : 'Anonymous' }}
                    </span>
                    <span class="text-xs text-slate-400">Joined {{ fmtDate(u.createdAt) }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <button
                    class="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60"
                    :class="u.isModerator
                      ? 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'"
                    :disabled="actingUser === u.id"
                    @click="toggleModerator(u)"
                  >
                    {{ u.isModerator ? 'Revoke mod' : 'Make mod' }}
                  </button>
                  <button
                    v-if="u.id !== auth.user?.id"
                    class="inline-flex items-center rounded-lg bg-red-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-red-500 disabled:opacity-60"
                    :disabled="actingUser === u.id"
                    @click="pendingDeleteUser = u"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </UiCard>
          </div>
        </div>

        <div v-if="!loadingUsers && users.length === 0 && !errorUsers" class="asku-muted">
          No users found.
        </div>
      </div>

      <!-- ── Audit Log tab ───────────────────────────────────────────────── -->
      <div v-if="activeTab === 'audit'" class="mt-4">
        <div v-if="loadingAudit" class="asku-muted">Loading…</div>
        <div v-if="errorAudit" class="asku-error">{{ errorAudit }}</div>

        <div v-if="!loadingAudit && !errorAudit && auditEntries.length === 0" class="asku-muted">
          No audit log entries yet.
        </div>

        <div v-if="!loadingAudit && auditEntries.length > 0" class="flex flex-col gap-2">
          <div class="text-sm text-slate-500 font-medium mb-2">
            {{ auditEntries.length }} entr{{ auditEntries.length === 1 ? 'y' : 'ies' }} (last 200)
          </div>
          <UiCard v-for="entry in auditEntries" :key="entry.id" :topbar="false">
            <div class="asku-card-pad flex items-start justify-between gap-4">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span
                    class="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold"
                    :class="describeEntry(entry).color"
                  >
                    {{ describeEntry(entry).label }}
                  </span>
                </div>
                <div v-if="describeEntry(entry).detail" class="mt-1 text-sm text-slate-500">
                  {{ describeEntry(entry).detail }}
                </div>
                <div class="mt-1.5 text-xs text-slate-400">
                  By: <span class="font-mono font-medium text-slate-700">{{ entry.actorEmail }}</span>
                </div>
              </div>
              <div class="asku-date shrink-0">{{ fmt(entry.createdAt) }}</div>
            </div>
          </UiCard>
        </div>
      </div>
    </div>
  </div>
</template>
