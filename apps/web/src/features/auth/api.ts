import { apiFetch } from "@/lib/fetch"
import type { User } from "@repo/types"

const BASE = "/api/auth"

export async function getMe(): Promise<User | null> {
  try {
    const data = await apiFetch<{ user: User | null }>(`${BASE}/me`)
    return data?.user ?? null
  } catch {
    // Network error or API not reachable — treat as unauthenticated
    return null
  }
}

export async function sendMagicLink(email: string): Promise<void> {
  await apiFetch(`${BASE}/send-magic-link`, {
    method: "POST",
    body: JSON.stringify({ email }),
  })
}

export async function verifyToken(token: string): Promise<User> {
  const data = await apiFetch<{ user: User | null }>(
    `${BASE}/verify?token=${encodeURIComponent(token)}`
  )
  if (!data.user) {
    throw new Error("Verification failed: no user returned")
  }
  return data.user
}

export async function logout(): Promise<void> {
  await apiFetch(`${BASE}/logout`, { method: "POST" })
}
