<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "select", reason: "spam" | "abuse"): void;
}>();

const open = ref(false);

function choose(reason: "spam" | "abuse") {
  if (props.disabled) return;
  open.value = false;
  emit("select", reason);
}

function toggle() {
  if (props.disabled) return;
  open.value = !open.value;
}
</script>

<template>
  <div class="report-wrap">
    <button
      class="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      :disabled="disabled"
      @click="toggle"
    >
      {{ disabled ? "Reporting..." : "Report" }} <span class="ml-1 opacity-60">▼</span>
    </button>

    <div v-if="open" class="report-menu">
      <button class="report-item" @click="choose('spam')">Spam</button>
      <button class="report-item" @click="choose('abuse')">Abuse</button>
    </div>
  </div>
</template>

<style scoped>
.report-wrap { position: relative; }
.report-menu {
  position: absolute;
  right: 0;
  bottom: 44px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  min-width: 160px;
  padding: 6px;
  box-shadow: 0 12px 30px rgba(0,0,0,.12);
}
.report-item {
  width: 100%;
  text-align: left;
  padding: 10px 10px;
  border-radius: 10px;
  background: transparent;
  border: 0;
  cursor: pointer;
}
.report-item:hover { background: #f3f4f6; }
</style>