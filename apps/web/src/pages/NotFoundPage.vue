<script setup lang="ts">
import { useRouter } from "vue-router";
const router = useRouter();
</script>

<template>
  <div class="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center px-4">
    <div class="text-6xl font-bold text-slate-200">404</div>
    <div class="text-xl font-semibold text-slate-700">Page not found</div>
    <div class="text-sm text-slate-400">
      This page doesn't exist or the content may have been deleted.
    </div>
    <button class="asku-btn mt-2" @click="router.push('/courses')">
      Go to Courses
    </button>
  </div>
</template>
