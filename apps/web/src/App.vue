<script setup lang="ts">
import AppHeader from "./components/AppHeader.vue";
import ToastHost from "./components/ToastHost.vue";
import { useInactivityLogout } from "./composables/useInactivityLogout";

useInactivityLogout();
</script>

<template>
  <div class="asku-shell">
    <AppHeader />
    <main class="asku-main">
      <router-view />
    </main>

    <ToastHost />
  </div>
</template>