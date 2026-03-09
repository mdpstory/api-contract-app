import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { db, sqlite } from "../db"
import { magicLinks, users } from "../db/schema"
import { eq } from "drizzle-orm"
import { generateId } from "../lib/id"
import { createSession, deleteSession, getCurrentUser } from "../lib/auth"
import { sendMagicLinkEmail } from "../lib/email"

// Magic link expires in 15 minutes
const MAGIC_LINK_TTL_MS = 1000 * 60 * 15

const sendMagicLinkSchema = z.object({
  email: z.string().email(),
})

export const authRoutes = new Hono()

  // POST /auth/send-magic-link
  .post(
    "/send-magic-link",
    zValidator("json", sendMagicLinkSchema),
    async (c) => {
      const { email } = c.req.valid("json")
      const normalizedEmail = email.trim().toLowerCase()

      // Find or create user
      let user = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .get()

      if (!user) {
        const newUser = {
          id: generateId(),
          email: normalizedEmail,
          name: null,
        }

        try {
          await db.insert(users).values(newUser)
        } catch {
          // Another request may have created the same user concurrently.
        }

        user = await db
          .select()
          .from(users)
          .where(eq(users.email, normalizedEmail))
          .get()
      }

      if (!user) {
        return c.json({ error: "Failed to create user" }, 500)
      }

      // Create magic link token
      const token = generateId()
      const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS).toISOString()

      await db.insert(magicLinks).values({
        id: generateId(),
        userId: user.id,
        token,
        expiresAt,
      })

      // Send email
      const webUrl = process.env["WEB_URL"] ?? "http://localhost:5173"
      const magicUrl = `${webUrl}/auth/verify?token=${token}`

      try {
        const delivery = await sendMagicLinkEmail({ to: normalizedEmail, magicUrl })
        if (delivery.mode === "console") {
          return c.json({
            message:
              "Email provider is not configured. Magic link was printed in API server log.",
            delivery: "console",
          })
        }

        return c.json({
          message: "Magic link sent. Check your email.",
          delivery: "email",
        })
      } catch (error) {
        // Keep token DB clean if delivery failed
        await db.delete(magicLinks).where(eq(magicLinks.token, token))

        const errMessage = error instanceof Error ? error.message : "Unknown"
        console.error("[AUTH] Failed to send magic link:", errMessage)

        return c.json(
          {
            error: "Failed to send magic link email",
            hint:
              "Check RESEND_API_KEY, EMAIL_FROM, verified domain, and spam folder.",
            ...(process.env["NODE_ENV"] !== "production"
              ? { detail: errMessage }
              : {}),
          },
          500
        )
      }
    }
  )

  // GET /auth/verify?token=xxx
  .get("/verify", async (c) => {
    const token = c.req.query("token")
    if (!token) {
      return c.json({ error: "Token is required" }, 400)
    }

    const now = new Date().toISOString()

    // Find token — include expired check separately so we can give better errors
    const link = await db
      .select()
      .from(magicLinks)
      .where(eq(magicLinks.token, token))
      .get()

    if (!link) {
      return c.json({ error: "Invalid or expired token" }, 400)
    }

    // Token expired
    if (link.expiresAt < now) {
      return c.json({ error: "This link has expired. Please request a new one." }, 400)
    }

    // Token already used — check if there is still a valid session for this user
    // This handles React StrictMode double-invoke and browser back/refresh edge cases
    if (link.usedAt) {
      const existingSession = await db.query.sessions.findFirst({
        where: (s, { and, eq, gt }) =>
          and(eq(s.userId, link.userId), gt(s.expiresAt, now)),
      })

      if (existingSession) {
        // Session still valid — re-set the cookie so browser has it and return user
        const user = await db
          .select()
          .from(users)
          .where(eq(users.id, link.userId))
          .get()
        // Re-issue cookie with existing session id (idempotent)
        const { setSessionCookieHeader } = await import("../lib/auth")
        setSessionCookieHeader(c, existingSession.id)
        return c.json({ user })
      }

      return c.json({ error: "This link has already been used. Please request a new one." }, 400)
    }

    const markUsedResult = sqlite
      .query("UPDATE magic_links SET used_at = ?1 WHERE id = ?2 AND used_at IS NULL")
      .run(now, link.id) as { changes?: number }

    if ((markUsedResult.changes ?? 0) === 0) {
      const existingSession = await db.query.sessions.findFirst({
        where: (s, { and, eq, gt }) =>
          and(eq(s.userId, link.userId), gt(s.expiresAt, now)),
      })

      if (existingSession) {
        const user = await db
          .select()
          .from(users)
          .where(eq(users.id, link.userId))
          .get()
        const { setSessionCookieHeader } = await import("../lib/auth")
        setSessionCookieHeader(c, existingSession.id)
        return c.json({ user })
      }

      return c.json({ error: "This link has already been used. Please request a new one." }, 400)
    }

    // Create new session
    const sessionId = generateId()
    await createSession(c, link.userId, sessionId)

    // Return user
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, link.userId))
      .get()

    return c.json({ user })
  })

  // POST /auth/logout
  .post("/logout", async (c) => {
    const cookieHeader = c.req.header("cookie") ?? ""
    const match = cookieHeader.match(/session=([^;]+)/)
    const sessionId = match?.[1]

    if (sessionId) {
      await deleteSession(c, sessionId)
    }

    return c.json({ message: "Logged out" })
  })

  // GET /auth/me
  .get("/me", async (c) => {
    const user = await getCurrentUser(c)
    return c.json({ user: user ?? null })
  })
