<script setup lang="ts">
import { ref, onBeforeUnmount, onMounted } from "vue";

const open = ref(false);

function toggle() {
  open.value = !open.value;
}

function close() {
  open.value = false;
}

function onDocClick(e: MouseEvent) {
  const target = e.target as HTMLElement | null;
  if (!target) return;
  if (target.closest("[data-report-root]")) return;
  close();
}

onMounted(() => document.addEventListener("click", onDocClick));
onBeforeUnmount(() => document.removeEventListener("click", onDocClick));

const emit = defineEmits<{
  (e: "select", reason: "spam" | "abuse" | "other"): void;
}>();

function pick(reason: "spam" | "abuse" | "other") {
  emit("select", reason);
  close();
}
</script>

<template>
  <div class="asku-dropdown" data-report-root>
    <button class="asku-btn-ghost" @click="toggle">
      Report <span style="margin-left: 6px; font-size: 12px; opacity: 0.6">▼</span>
    </button>

    <div v-if="open" class="asku-dropdown-menu">
      <button class="asku-dropdown-item" @click="pick('spam')">Spam</button>
      <button class="asku-dropdown-item" @click="pick('abuse')">Abuse</button>
      <button class="asku-dropdown-item" @click="pick('other')">Other</button>
    </div>
  </div>
</template>
