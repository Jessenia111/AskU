<script setup lang="ts">
import AppHeader from "./components/AppHeader.vue";
</script>

<template>
  <div class="asku-shell">
    <AppHeader initials="U" />
    <main class="asku-main">
      <router-view />
    </main>
  </div>
</template>
