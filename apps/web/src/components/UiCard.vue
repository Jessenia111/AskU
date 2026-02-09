<script setup lang="ts">
defineProps<{ topbar?: boolean; pad?: boolean }>();
</script>

<template>
  <div class="asku-card">
    <div v-if="topbar" class="asku-card-topbar"></div>
    <div :class="pad === false ? '' : 'asku-card-pad'">
      <slot />
    </div>
  </div>
</template>
