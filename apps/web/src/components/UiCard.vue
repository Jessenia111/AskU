<script setup lang="ts">
defineProps<{ topbar?: boolean }>();
</script>

<template>
  <div class="asku-card">
    <div v-if="topbar" class="asku-card-topbar"></div>
    <slot />
  </div>
</template>
