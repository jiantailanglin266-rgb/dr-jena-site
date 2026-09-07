"use client";
/** Small fetch helper for client components. */
export async function api<T = unknown>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: T; error?: string; details?: unknown };
  if (!res.ok || data.ok === false) {
    const err = new Error(data.error ?? `Request failed (${res.status})`) as Error & { details?: unknown; status?: number };
    err.details = data.details;
    err.status = res.status;
    throw err;
  }
  return data.data as T;
}
