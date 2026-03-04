import { onMounted, onUnmounted, type Ref } from "vue";

/**
 * Calls `callback` when a click occurs outside the given element ref.
 */
export function useClickOutside(el: Ref<HTMLElement | null>, callback: () => void) {
  function handler(e: MouseEvent) {
    if (el.value && !el.value.contains(e.target as Node)) {
      callback();
    }
  }

  onMounted(() => document.addEventListener("mousedown", handler));
  onUnmounted(() => document.removeEventListener("mousedown", handler));
}
