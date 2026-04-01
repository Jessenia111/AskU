<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-sm p-8">

      <!-- Step 1 & 2: Enter code -->
      <template v-if="step === 'code'">
        <div class="text-3xl font-semibold">Verify email</div>
        <div class="text-zinc-600 mt-2">
          We sent a 6-digit code to <span class="font-medium">{{ email }}</span>.
        </div>

        <form class="mt-6 space-y-4" @submit.prevent="onSubmit">
          <div>
            <label class="block text-sm font-medium mb-2">Verification code</label>
            <input
              v-model="code"
              class="w-full rounded-xl border border-zinc-300 px-4 py-3 text-lg tracking-widest"
              inputmode="numeric"
              autocomplete="one-time-code"
              placeholder="123456"
              maxlength="6"
            />
          </div>

          <button
            class="w-full rounded-xl bg-zinc-700 text-white py-3 font-medium disabled:opacity-60"
            :disabled="loading || code.trim().length !== 6"
            type="submit"
          >
            <span v-if="!loading">Verify & continue</span>
            <span v-else>Verifying...</span>
          </button>

          <div v-if="error" class="text-sm text-red-600">
            {{ error }}
          </div>
        </form>

        <div class="mt-6 flex items-center justify-between text-sm">
          <button
            class="text-zinc-700 underline disabled:opacity-60"
            :disabled="resendLoading || resendCooldown > 0"
            @click="resend"
          >
            <span v-if="resendCooldown === 0 && !resendLoading">Resend code</span>
            <span v-if="resendLoading">Sending…</span>
            <span v-if="resendCooldown > 0">Resend in {{ resendCooldown }}s</span>
          </button>

          <button class="text-zinc-700 underline" @click="goBack">
            Change email
          </button>
        </div>
      </template>

      <!-- Step 3: Choose identity (shown only for new users / first login) -->
      <template v-if="step === 'identity'">
        <div class="text-3xl font-semibold">How should you appear?</div>
        <div class="text-zinc-500 mt-2 text-sm leading-relaxed">
          Choose how other students see you on AskU. You can always update this later in your profile.
        </div>

        <div class="mt-6 flex flex-col gap-3">
          <!-- Anonymous option -->
          <button
            class="w-full rounded-xl border-2 px-5 py-4 text-left transition-all"
            :class="chosenMode === 'ANONYMOUS'
              ? 'border-zinc-900 bg-zinc-50'
              : 'border-zinc-200 hover:border-zinc-400'"
            @click="chosenMode = 'ANONYMOUS'"
          >
            <div class="font-semibold text-zinc-900">Anonymous (recommended)</div>
            <div class="text-sm text-zinc-500 mt-1">
              You appear as a random pseudonym that changes every 24 hours.
              Other students will not know who you are.
            </div>
          </button>

          <!-- Real name option -->
          <button
            class="w-full rounded-xl border-2 px-5 py-4 text-left transition-all"
            :class="chosenMode === 'REAL_NAME'
              ? 'border-zinc-900 bg-zinc-50'
              : 'border-zinc-200 hover:border-zinc-400'"
            @click="chosenMode = 'REAL_NAME'"
          >
            <div class="font-semibold text-zinc-900">Use my real name</div>
            <div class="text-sm text-zinc-500 mt-1">
              You appear as <span class="font-semibold text-zinc-700">{{ derivedName }}</span>.
              All other students will see your real name on every post and comment.
            </div>
          </button>
        </div>

        <div v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</div>

        <button
          class="mt-6 w-full rounded-xl bg-zinc-900 text-white py-3 font-medium disabled:opacity-60"
          :disabled="!chosenMode || savingMode"
          @click="saveIdentityChoice"
        >
          <span v-if="!savingMode">Continue</span>
          <span v-else>Saving…</span>
        </button>
      </template>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { apiFetch, ApiError } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { REDIRECT_KEY } from "../router";

const router = useRouter();
const auth = useAuthStore();

const email = ref("");
const code = ref("");
const loading = ref(false);
const resendLoading = ref(false);
const error = ref<string | null>(null);

const resendCooldown = ref(0);
let cooldownTimer: number | null = null;

const step = ref<"code" | "identity">("code");
const chosenMode = ref<"ANONYMOUS" | "REAL_NAME" | null>(null);
const savingMode = ref(false);

/** Derive the display name from the email — mirrors backend logic. */
const derivedName = computed(() => {
  const local = email.value.split("@")[0] ?? "";
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  const parts = local.split(".").filter(Boolean).slice(0, 2);
  return parts.map(capitalize).join(" ") || local;
});

function startCooldown(seconds: number) {
  resendCooldown.value = seconds;
  if (cooldownTimer) window.clearInterval(cooldownTimer);
  cooldownTimer = window.setInterval(() => {
    resendCooldown.value -= 1;
    if (resendCooldown.value <= 0 && cooldownTimer) {
      window.clearInterval(cooldownTimer);
      cooldownTimer = null;
      resendCooldown.value = 0;
    }
  }, 1000);
}

function goBack() {
  sessionStorage.removeItem("asku_auth_email");
  router.push("/login");
}

async function resend() {
  error.value = null;
  resendLoading.value = true;
  try {
    await apiFetch("/api/v1/auth/request", {
      method: "POST",
      body: JSON.stringify({ email: email.value }),
    });
    startCooldown(30);
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : String(e);
  } finally {
    resendLoading.value = false;
  }
}

async function onSubmit() {
  error.value = null;
  loading.value = true;
  try {
    await apiFetch("/api/v1/auth/verify", {
      method: "POST",
      body: JSON.stringify({ email: email.value, code: code.value.trim() }),
    });

    sessionStorage.removeItem("asku_auth_email");
    await auth.refresh();

    // If displayMode has never been set, show the identity choice step
    if (auth.user?.displayMode === null || auth.user?.displayMode === undefined) {
      step.value = "identity";
    } else {
      redirectAfterLogin();
    }
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function saveIdentityChoice() {
  if (!chosenMode.value) return;
  error.value = null;
  savingMode.value = true;
  try {
    await apiFetch("/api/v1/me/display-mode", {
      method: "PATCH",
      body: JSON.stringify({ displayMode: chosenMode.value }),
    });
    await auth.refresh();
    redirectAfterLogin();
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : String(e);
  } finally {
    savingMode.value = false;
  }
}

function redirectAfterLogin() {
  const redirect = sessionStorage.getItem(REDIRECT_KEY) ?? "/courses";
  sessionStorage.removeItem(REDIRECT_KEY);
  router.push(redirect);
}

onMounted(() => {
  const stored = sessionStorage.getItem("asku_auth_email");
  if (!stored) {
    router.push("/login");
    return;
  }
  email.value = stored;
});
</script>
