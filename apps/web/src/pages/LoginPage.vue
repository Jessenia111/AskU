<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">

      <!-- Quick login banner when saved email exists -->
      <div
        v-if="savedEmail && !showFullForm"
        class="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4"
      >
        <p class="text-sm text-zinc-600 mb-3">
          Continue as <span class="font-semibold text-zinc-900">{{ savedEmail }}</span>?
        </p>
        <button
          class="w-full rounded-xl bg-zinc-900 px-4 py-2 text-white disabled:opacity-60 mb-2"
          :disabled="loading"
          @click="quickLogin"
        >
          <span v-if="!loading">Send me the code</span>
          <span v-else>Sending…</span>
        </button>
        <button
          class="w-full rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
          @click="showFullForm = true"
        >
          Use a different email
        </button>
        <p v-if="error" class="mt-2 text-sm text-red-600">{{ error }}</p>
      </div>

      <!-- Full login form -->
      <template v-if="!savedEmail || showFullForm">
        <h1 class="text-2xl font-semibold">Log in to AskU</h1>
        <p v-if="DOMAIN" class="mt-1 text-sm text-zinc-600">
          Use your University of Tartu email (<span class="font-medium">{{ domainHint }}</span>).
        </p>
        <p v-else class="mt-1 text-sm text-zinc-600">Enter your email address.</p>

        <form class="mt-6 space-y-4" @submit.prevent="onSubmit">
          <div>
            <label class="block text-sm font-medium text-zinc-800">Email</label>
            <input
              v-model.trim="email"
              type="email"
              autocomplete="email"
              inputmode="email"
              :placeholder="DOMAIN ? `name.surname@${DOMAIN}` : 'your@email.com'"
              class="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900/10"
              :disabled="loading"
            />
            <p v-if="email && !isAllowedEmail(email)" class="mt-1 text-xs text-red-600">
              {{ DOMAIN ? `Email must end with @${DOMAIN}` : 'Please enter a valid email' }}
            </p>
          </div>

          <button
            type="submit"
            class="w-full rounded-xl bg-zinc-900 px-4 py-2 text-white disabled:opacity-60"
            :disabled="loading || !canSubmit"
          >
            <span v-if="!loading">Send verification code</span>
            <span v-else>Sending…</span>
          </button>

          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        </form>
      </template>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { apiFetch } from "../api/client";

const router = useRouter();

const email = ref("");
const savedEmail = ref<string | null>(null);
const showFullForm = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);

const SAVED_EMAIL_KEY = "asku_saved_email";

onMounted(() => {
  const saved = localStorage.getItem(SAVED_EMAIL_KEY);
  if (saved) {
    savedEmail.value = saved;
    email.value = saved;
  }
});

const DOMAIN = (import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN as string || "").trim().toLowerCase();

function isAllowedEmail(value: string) {
  const v = value.trim().toLowerCase();
  if (!DOMAIN) return v.includes("@") && v.length > 3;
  return v.endsWith(`@${DOMAIN}`) && v.length > `@${DOMAIN}`.length;
}

const domainHint = DOMAIN ? `@${DOMAIN}` : "any email";
const canSubmit = computed(() => isAllowedEmail(email.value) && !loading.value);

async function sendCode(targetEmail: string) {
  error.value = null;
  loading.value = true;
  try {
    await apiFetch("/api/v1/auth/request", {
      method: "POST",
      body: JSON.stringify({ email: targetEmail }),
    });
    const cleanEmail = targetEmail.trim().toLowerCase();
    sessionStorage.setItem("asku_auth_email", cleanEmail);
    localStorage.setItem(SAVED_EMAIL_KEY, cleanEmail);
    router.push("/verify");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Request failed";
  } finally {
    loading.value = false;
  }
}

async function quickLogin() {
  if (!savedEmail.value) return;
  await sendCode(savedEmail.value);
}

async function onSubmit() {
  const value = email.value.trim().toLowerCase();
  if (!isAllowedEmail(value)) {
    error.value = DOMAIN ? `Please enter a valid @${DOMAIN} email.` : "Please enter a valid email.";
    return;
  }
  await sendCode(value);
}
</script>
