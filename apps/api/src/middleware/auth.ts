import { createMiddleware } from "hono/factory"
import { getCurrentUser } from "../lib/auth"
import type { UserRow } from "../db/schema"

type AuthEnv = {
  Variables: {
    user: UserRow
  }
}

/**
 * Middleware that enforces authentication.
 * Attaches the current user to context as `c.var.user`.
 * Returns 401 if not authenticated.
 */
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const user = await getCurrentUser(c)
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401)
  }
  c.set("user", user)
  await next()
})
