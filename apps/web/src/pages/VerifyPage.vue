<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-sm p-8">
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

      <div class="text-xs text-zinc-500 mt-6">
        Dev: verification code is printed in the API console.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { apiFetch } from "../api/client";

const router = useRouter();

const email = ref("");
const code = ref("");
const loading = ref(false);
const resendLoading = ref(false);
const error = ref<string | null>(null);

const resendCooldown = ref(0);
let cooldownTimer: number | null = null;

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
    error.value = String(e);
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
    router.push("/courses");
  } catch (e) {
    error.value = String(e);
  } finally {
    loading.value = false;
  }
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