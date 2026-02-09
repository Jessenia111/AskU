<script setup lang="ts">
const props = defineProps<{ initials?: string }>();
</script>

<template>
  <header class="asku-header">
    <div class="asku-header-inner">
      <div class="asku-brand">
        <div class="asku-avatar">{{ props.initials ?? "U" }}</div>
        <div>
          <div class="asku-brand-title">AskU</div>
          <div class="asku-brand-subtitle">Anonymous student questions</div>
        </div>
      </div>

      <button class="asku-menu-btn" aria-label="Menu">
        <span style="font-size: 22px; line-height: 1">≡</span>
      </button>
    </div>
  </header>
</template>
