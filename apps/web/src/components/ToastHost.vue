<script setup lang="ts">
import { computed } from "vue";
import { useToast } from "../composables/useToast";

const toast = useToast();
const items = computed(() => toast.items.value);

function close(id: string) {
  toast.remove(id);
}
</script>

<template>
  <div class="toast-host">
    <div v-for="t in items" :key="t.id" class="toast" :class="t.type">
      <div class="toast-text">{{ t.message }}</div>
      <button class="toast-x" @click="close(t.id)">×</button>
    </div>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  right: 16px;
  bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 9999;
}

.toast {
  min-width: 260px;
  max-width: 360px;
  padding: 12px 12px;
  border-radius: 14px;
  background: #111827;
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 10px 25px rgba(0,0,0,.25);
}

.toast.success { background: #064e3b; }
.toast.error { background: #7f1d1d; }
.toast.info { background: #1f2937; }

.toast-text { font-size: 14px; line-height: 1.2; }
.toast-x {
  border: 0;
  background: transparent;
  color: white;
  font-size: 20px;
  cursor: pointer;
  opacity: .8;
}
.toast-x:hover { opacity: 1; }
</style>