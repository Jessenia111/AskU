import { ref } from "vue";

type ToastType = "success" | "error" | "info";

type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
  timeoutMs: number;
};

const items = ref<ToastItem[]>([]);

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function useToast() {
  function push(type: ToastType, message: string, timeoutMs = 2500) {
    const id = uid();
    items.value.push({ id, type, message, timeoutMs });

    window.setTimeout(() => {
      remove(id);
    }, timeoutMs);

    return id;
  }

  function remove(id: string) {
    items.value = items.value.filter((x) => x.id !== id);
  }

  return {
    items,
    push,
    remove,
  };
}