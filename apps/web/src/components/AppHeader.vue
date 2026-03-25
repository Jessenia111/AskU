<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { apiFetch } from "../api/client";
import { useToast } from "../composables/useToast";
import { useAuthStore } from "../stores/auth";
import { useClickOutside } from "../composables/useClickOutside";

const router = useRouter();
const toast = useToast();
const auth = useAuthStore();
const isDev = import.meta.env.DEV;

const open = ref(false);
const menuRef = ref<HTMLElement | null>(null);
useClickOutside(menuRef, () => { open.value = false; });

async function logout() {
  try {
    await apiFetch("/api/v1/auth/logout", { method: "POST" });
  } catch {}
  auth.clear();
  toast.push("info", "Logged out");
  open.value = false;
  await router.push("/login");
}

function go(path: string) {
  open.value = false;
  router.push(path);
}
</script>

<template>
  <header class="asku-header">
    <div class="asku-brand" @click="go('/courses')">
      <div class="asku-avatar">{{ auth.initials }}</div>
      <div>
        <div class="asku-title">AskU</div>
        <div class="asku-subtitle">Anonymous student questions</div>
      </div>
    </div>

    <div ref="menuRef" class="asku-header-right">
      <div v-if="auth.user" class="asku-me">{{ auth.user.email }}</div>

      <button class="asku-menu-btn" @click="open = !open">≡</button>

      <div v-if="open" class="asku-menu">
        <button class="asku-menu-item" @click="go('/courses')">Courses</button>
        <button class="asku-menu-item" @click="go('/profile')">My Profile</button>
        <button class="asku-menu-item" @click="go('/moderation')">Moderation</button>
        <button v-if="isDev" class="asku-menu-item" @click="go('/dev')">Dev Tools</button>
        <div class="asku-menu-sep"></div>
        <button class="asku-menu-item danger" @click="logout">Logout</button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.asku-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #e5e7eb;
  background: white;
  position: sticky;
  top: 0;
  z-index: 50;
}

.asku-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

.asku-avatar {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  background: #2563eb;
  color: white;
  display: grid;
  place-items: center;
  font-weight: 800;
}

.asku-title {
  font-weight: 800;
  font-size: 18px;
  line-height: 1.1;
}
.asku-subtitle {
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
}

.asku-header-right {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
}

.asku-me {
  font-size: 12px;
  color: #64748b;
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asku-menu-btn {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  background: white;
  cursor: pointer;
  font-size: 20px;
}

.asku-menu {
  position: absolute;
  right: 0;
  top: 52px;
  width: 190px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 8px;
  box-shadow: 0 12px 30px rgba(0,0,0,.12);
}

.asku-menu-item {
  width: 100%;
  text-align: left;
  padding: 10px 10px;
  border-radius: 10px;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.asku-menu-item:hover {
  background: #f3f4f6;
}

.asku-menu-item.danger {
  color: #b91c1c;
}

.asku-menu-sep {
  height: 1px;
  background: #e5e7eb;
  margin: 6px 0;
}
</style>