<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";

withDefaults(defineProps<{
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}>(), {
  confirmLabel: "Confirm",
  danger: false,
});

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") emit("cancel");
}
onMounted(() => document.addEventListener("keydown", onKeydown));
onUnmounted(() => document.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center px-4">
    <div class="absolute inset-0 bg-black/40" @click="emit('cancel')" />
    <div class="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
      <h2 class="text-lg font-semibold text-slate-900">{{ title }}</h2>
      <p class="mt-2 text-sm text-slate-600">{{ message }}</p>
      <div class="mt-5 flex justify-end gap-3">
        <button class="asku-btn-ghost" @click="emit('cancel')">Cancel</button>
        <button
          :class="danger ? 'asku-btn-danger' : 'asku-btn'"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
