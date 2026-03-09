import { db } from "../db"
import { projects, sessions, users } from "../db/schema"
import { eq, and, gt, desc } from "drizzle-orm"
import type { Context } from "hono"
import type { UserRow } from "../db/schema"
import { generateId } from "./id"

export const SESSION_COOKIE_NAME = "session"
// 30 days in milliseconds
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30
// 7 days idle timeout in milliseconds
export const SESSION_IDLE_MS = 1000 * 60 * 60 * 24 * 7

/**
 * Get the current authenticated user from the request session cookie.
 * Returns null if not authenticated or session expired.
 */
export async function getSessionUser(
  c: Context
): Promise<UserRow | null> {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME)
  if (!sessionId) return null

  const now = new Date().toISOString()

  const row = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.id, sessionId),
        gt(sessions.expiresAt, now)
      )
    )
    .get()

  if (!row) return null

  return row.user
}

export function isAuthBypassEnabled(): boolean {
  const isProd = process.env["NODE_ENV"] === "production"
  if (isProd) return false
  return process.env["AUTH_DISABLED"] === "true"
}

async function getDevUser(c: Context): Promise<UserRow> {
  const pathMatch = c.req.path.match(/\/projects\/([^/]+)/)
  const projectId = pathMatch?.[1] ? decodeURIComponent(pathMatch[1]) : undefined

  if (projectId) {
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .get()

    if (project) {
      const owner = await db
        .select()
        .from(users)
        .where(eq(users.id, project.ownerId))
        .get()
      if (owner) return owner
    }
  }

  const latestProject = await db
    .select()
    .from(projects)
    .orderBy(desc(projects.createdAt))
    .get()

  if (latestProject) {
    const owner = await db
      .select()
      .from(users)
      .where(eq(users.id, latestProject.ownerId))
      .get()
    if (owner) return owner
  }

  const latestUser = await db
    .select()
    .from(users)
    .orderBy(desc(users.createdAt))
    .get()
  if (latestUser) return latestUser

  const id = generateId()
  await db.insert(users).values({
    id,
    email: process.env["DEV_AUTH_EMAIL"] ?? "dev@local.test",
    name: "Dev User",
  })

  const created = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .get()

  if (created) return created

  throw new Error("Failed to create development auth user")
}

export async function getCurrentUser(c: Context): Promise<UserRow | null> {
  const sessionUser = await getSessionUser(c)
  if (sessionUser) return sessionUser

  if (!isAuthBypassEnabled()) return null

  return getDevUser(c)
}

/**
 * Create a new session for a user and set the cookie.
 */
export async function createSession(
  c: Context,
  userId: string,
  sessionId: string
): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt,
  })

  setSessionCookie(c, sessionId, SESSION_TTL_MS / 1000)
}

/**
 * Delete a session and clear the cookie.
 */
export async function deleteSession(
  c: Context,
  sessionId: string
): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId))
  clearSessionCookie(c)
}

/**
 * Re-set an existing session cookie without touching the DB.
 * Useful for idempotent verify flows (e.g. React StrictMode double-mount).
 */
export function setSessionCookieHeader(c: Context, sessionId: string): void {
  setSessionCookie(c, sessionId, SESSION_TTL_MS / 1000)
}

// ─── Cookie helpers ───────────────────────────────────────────────────────────

function getCookie(c: Context, name: string): string | undefined {
  const cookieHeader = c.req.header("cookie")
  if (!cookieHeader) return undefined
  const cookies = cookieHeader.split(";").map((s) => s.trim())
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.split("=")
    if (key?.trim() === name) return rest.join("=")
  }
  return undefined
}

function setSessionCookie(
  c: Context,
  value: string,
  maxAgeSeconds: number
): void {
  const isProd = process.env["NODE_ENV"] === "production"
  c.header(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${isProd ? "; Secure" : ""}`
  )
}

function clearSessionCookie(c: Context): void {
  c.header(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
  )
}
