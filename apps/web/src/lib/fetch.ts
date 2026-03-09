/**
 * Safe JSON parse — returns null if body is empty or not valid JSON.
 */
async function safeJson<T>(res: Response): Promise<T | null> {
  const text = await res.text()
  if (!text || text.trim() === "") return null
  try {
    return JSON.parse(text) as T
  } catch {
    console.error("[fetch] Non-JSON response:", text.slice(0, 200))
    return null
  }
}

/**
 * Wrapper around fetch that:
 * - Always includes credentials (cookie)
 * - Parses JSON safely
 * - Throws a readable error on non-OK responses
 */
export async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  })

  const data = await safeJson<T & { error?: string }>(res)

  if (!res.ok) {
    const body = data as { error?: string; detail?: string; hint?: string } | null
    // Build a combined message: primary error + detail (if present)
    const base = body?.error ?? `HTTP ${res.status}: ${res.statusText}`
    const extra = body?.detail ?? body?.hint
    const message = extra ? `${base} — ${extra}` : base
    throw new Error(message)
  }

  return data as T
}
