const API_BASE = "http://localhost:8000";

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
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
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
    throw new ApiError(res.status, friendlyMessage(res.status, serverMsg), retryAfter);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  if (!text) return undefined as T;

  return JSON.parse(text) as T;
}