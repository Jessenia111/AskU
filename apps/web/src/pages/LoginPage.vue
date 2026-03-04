<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h1 class="text-2xl font-semibold">Log in to AskU</h1>
      <p class="mt-1 text-sm text-zinc-600">
        Use your University of Tartu email (<span class="font-medium">@ut.ee</span>).
      </p>

      <form class="mt-6 space-y-4" @submit.prevent="onSubmit">
        <div>
          <label class="block text-sm font-medium text-zinc-800">Email</label>
          <input
            v-model.trim="email"
            type="email"
            autocomplete="email"
            inputmode="email"
            placeholder="name.surname@ut.ee"
            class="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900/10"
            :disabled="loading"
          />
          <p v-if="email && !isUtEmail(email)" class="mt-1 text-xs text-red-600">
            Email must end with @ut.ee
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

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { apiFetch } from "../api/client";

const router = useRouter();

const email = ref("");
const loading = ref(false);
const error = ref<string | null>(null);

function isUtEmail(value: string) {
  const v = value.trim().toLowerCase();
  return v.endsWith("@ut.ee") && v.length > "@ut.ee".length;
}

const canSubmit = computed(() => isUtEmail(email.value) && !loading.value);

async function onSubmit() {
  error.value = null;

  const value = email.value.trim().toLowerCase();
  if (!isUtEmail(value)) {
    error.value = "Please enter a valid @ut.ee email.";
    return;
  }

  loading.value = true;
  try {
   await apiFetch("/api/v1/auth/request", {
    method: "POST",
    body: JSON.stringify({ email: email.value }),
    });

    sessionStorage.setItem("asku_auth_email", email.value.trim().toLowerCase());
    router.push("/verify");
  } catch (e: any) {
    error.value = typeof e?.message === "string" ? e.message : "Request failed";
  } finally {
    loading.value = false;
  }
}
</script>