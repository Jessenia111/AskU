import { useAuthStore } from "../stores/auth";

// Empty string means "use relative URLs" — Vercel proxy (vercel.json) handles forwarding to Railway.
// Fallback to localhost only when the variable is completely absent (local dev without .env).
const _rawBase = import.meta.env.VITE_API_BASE;
const API_BASE: string = _rawBase !== undefined ? _rawBase : "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function friendlyMessage(status: number, serverMsg: string): string {
  if (status === 401) return "You need to be logged in to do that.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "Not found — this content may have been deleted.";
  if (status === 429) return "Too many requests — please wait a moment and try again.";
  return serverMsg || `Request failed (${status})`;
}

export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const hasBody = init.method && init.method !== "GET" && init.method !== "HEAD";
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const retryAfter = res.headers.get("Retry-After")
      ? Number(res.headers.get("Retry-After"))
      : undefined;
    let serverMsg = "";
    try {
      const body = await res.json();
      serverMsg = body?.error ?? "";
    } catch {
      serverMsg = await res.text().catch(() => "");
    }
    if (res.status === 401) {
      try { useAuthStore().clear(); } catch { /* pinia may not be ready */ }
    }
    throw new ApiError(res.status, friendlyMessage(res.status, serverMsg), retryAfter);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  if (!text) return undefined as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(res.status, "Unexpected response from server");
  }
}