import { db } from "../db"
import { projects, users } from "../db/schema"
import { eq, desc } from "drizzle-orm"
import type { Context } from "hono"
import type { UserRow } from "../db/schema"
import { generateId } from "./id"

export const SESSION_COOKIE_NAME = "session"
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30
const JWT_ALG = "HS256"

type SessionTokenPayload = {
  sub: string
  iat: number
  exp: number
}

let jwtKeyPromise: Promise<CryptoKey> | undefined

function getJwtSecret(): string {
  const configured = process.env["JWT_SECRET"]
  if (configured) return configured

  if (process.env["NODE_ENV"] !== "production") {
    return "dev-jwt-secret-change-me"
  }

  throw new Error("JWT_SECRET is required in production")
}

function getJwtKey(): Promise<CryptoKey> {
  if (!jwtKeyPromise) {
    jwtKeyPromise = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(getJwtSecret()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    )
  }

  return jwtKeyPromise
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4))

  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8")
}

async function signSessionToken(payload: SessionTokenPayload): Promise<string> {
  const header = encodeBase64Url(JSON.stringify({ alg: JWT_ALG, typ: "JWT" }))
  const body = encodeBase64Url(JSON.stringify(payload))
  const signingInput = `${header}.${body}`
  const key = await getJwtKey()
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signingInput)
  )
  const signature = Buffer.from(signatureBuffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")

  return `${signingInput}.${signature}`
}

async function verifySessionToken(token: string): Promise<SessionTokenPayload | null> {
  const [header, body, signature] = token.split(".")
  if (!header || !body || !signature) return null

  try {
    const decodedHeader = JSON.parse(decodeBase64Url(header)) as {
      alg?: string
      typ?: string
    }

    if (decodedHeader.alg !== JWT_ALG || decodedHeader.typ !== "JWT") {
      return null
    }

    const signingInput = `${header}.${body}`
    const key = await getJwtKey()
    const verified = await crypto.subtle.verify(
      "HMAC",
      key,
      Buffer.from(signature.replace(/-/g, "+").replace(/_/g, "/"), "base64"),
      new TextEncoder().encode(signingInput)
    )

    if (!verified) return null

    const payload = JSON.parse(decodeBase64Url(body)) as Partial<SessionTokenPayload>
    if (typeof payload.sub !== "string") return null
    if (typeof payload.iat !== "number") return null
    if (typeof payload.exp !== "number") return null
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null

    return {
      sub: payload.sub,
      iat: payload.iat,
      exp: payload.exp,
    }
  } catch {
    return null
  }
}

/**
 * Get the current authenticated user from the request session cookie.
 * Returns null if not authenticated or session expired.
 */
export async function getSessionUser(
  c: Context
): Promise<UserRow | null> {
  const sessionToken = getCookie(c, SESSION_COOKIE_NAME)
  if (!sessionToken) return null

  const payload = await verifySessionToken(sessionToken)
  if (!payload) return null

  return db
    .select()
    .from(users)
    .where(eq(users.id, payload.sub))
    .then((rows) => rows[0] ?? null)
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
      .then((rows) => rows[0] ?? null)

    if (project) {
      const owner = await db
        .select()
        .from(users)
        .where(eq(users.id, project.ownerId))
        .then((rows) => rows[0] ?? null)
      if (owner) return owner
    }
  }

  const latestProject = await db
    .select()
    .from(projects)
    .orderBy(desc(projects.createdAt))
    .then((rows) => rows[0] ?? null)

  if (latestProject) {
    const owner = await db
      .select()
      .from(users)
      .where(eq(users.id, latestProject.ownerId))
      .then((rows) => rows[0] ?? null)
    if (owner) return owner
  }

  const latestUser = await db
    .select()
    .from(users)
    .orderBy(desc(users.createdAt))
    .then((rows) => rows[0] ?? null)
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
    .then((rows) => rows[0] ?? null)

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
 * Create a signed JWT session cookie for a user.
 */
export async function createSession(
  c: Context,
  userId: string
): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  const token = await signSessionToken({
    sub: userId,
    iat: now,
    exp: now + Math.floor(SESSION_TTL_MS / 1000),
  })

  setSessionCookie(c, token, SESSION_TTL_MS / 1000)
}

/**
 * Clear the auth cookie.
 */
export async function deleteSession(c: Context): Promise<void> {
  clearSessionCookie(c)
}

/**
 * Re-issue a fresh JWT cookie for the given user id.
 */
export async function setSessionCookieHeader(
  c: Context,
  userId: string
): Promise<void> {
  await createSession(c, userId)
}

export async function getCurrentSessionUserId(c: Context): Promise<string | null> {
  const sessionToken = getCookie(c, SESSION_COOKIE_NAME)
  if (!sessionToken) return null

  const payload = await verifySessionToken(sessionToken)
  return payload?.sub ?? null
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
