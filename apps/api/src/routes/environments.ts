import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { db } from "../db"
import { envVariables, environments, projectMembers } from "../db/schema"
import { and, eq, ne } from "drizzle-orm"
import { generateId } from "../lib/id"
import { requireAuth } from "../middleware/auth"
import type { UserRow } from "../db/schema"

type AuthEnv = { Variables: { user: UserRow } }

const variableSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().max(2000),
})

const createEnvironmentSchema = z.object({
  name: z.string().min(1).max(100),
  variables: z.array(variableSchema).optional(),
})

const updateEnvironmentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  variables: z.array(variableSchema).optional(),
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function assertMembership(
  projectId: string,
  userId: string
): Promise<boolean> {
  const row = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId)
      )
    )
    .get()
  return !!row
}

async function getEnvironmentWithVariables(envId: string) {
  const env = await db
    .select()
    .from(environments)
    .where(eq(environments.id, envId))
    .get()

  if (!env) return null

  const vars = await db
    .select()
    .from(envVariables)
    .where(eq(envVariables.environmentId, envId))

  return { ...env, variables: vars }
}

function normalizeEnvironmentName(name: string): string {
  return name.trim()
}

function normalizeVariables(
  variables: Array<{ key: string; value: string }>
): Array<{ key: string; value: string }> {
  return variables
    .map((variable) => ({ key: variable.key.trim(), value: variable.value }))
    .filter((variable) => variable.key.length > 0)
}

function hasDuplicateVariableKeys(
  variables: Array<{ key: string; value: string }>
): boolean {
  const keys = new Set<string>()

  for (const variable of variables) {
    if (keys.has(variable.key)) {
      return true
    }
    keys.add(variable.key)
  }

  return false
}

async function hasEnvironmentNameConflict(
  projectId: string,
  name: string,
  excludeId?: string
): Promise<boolean> {
  const conflict = await db
    .select({ id: environments.id })
    .from(environments)
    .where(
      excludeId
        ? and(
            eq(environments.projectId, projectId),
            eq(environments.name, name),
            ne(environments.id, excludeId)
          )
        : and(eq(environments.projectId, projectId), eq(environments.name, name))
    )
    .get()

  return !!conflict
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export const environmentRoutes = new Hono<AuthEnv>()

  .use(requireAuth)

  // GET /projects/:projectId/environments
  .get("/projects/:projectId/environments", async (c) => {
    const user = c.var.user
    const { projectId } = c.req.param()

    if (!(await assertMembership(projectId, user.id))) {
      return c.json({ error: "Project not found" }, 404)
    }

    const envs = await db
      .select()
      .from(environments)
      .where(eq(environments.projectId, projectId))

    const result = await Promise.all(
      envs.map(async (env) => {
        const vars = await db
          .select()
          .from(envVariables)
          .where(eq(envVariables.environmentId, env.id))
        return { ...env, variables: vars }
      })
    )

    return c.json(result)
  })

  // POST /projects/:projectId/environments
  .post(
    "/projects/:projectId/environments",
    zValidator("json", createEnvironmentSchema),
    async (c) => {
      const user = c.var.user
      const { projectId } = c.req.param()
      const body = c.req.valid("json")
      const normalizedName = normalizeEnvironmentName(body.name)
      const normalizedVariables = normalizeVariables(body.variables ?? [])

      if (!(await assertMembership(projectId, user.id))) {
        return c.json({ error: "Project not found" }, 404)
      }

      if (!normalizedName) {
        return c.json({ error: "Environment name cannot be empty" }, 400)
      }

      if (await hasEnvironmentNameConflict(projectId, normalizedName)) {
        return c.json({ error: "Environment name already exists" }, 409)
      }

      if (hasDuplicateVariableKeys(normalizedVariables)) {
        return c.json({ error: "Environment variable keys must be unique" }, 400)
      }

      const envId = generateId()

      await db.transaction(async (tx) => {
        await tx.insert(environments).values({
          id: envId,
          projectId,
          name: normalizedName,
          isGlobal: false,
        })

        if (normalizedVariables.length > 0) {
          await tx.insert(envVariables).values(
            normalizedVariables.map((variable) => ({
              id: generateId(),
              environmentId: envId,
              key: variable.key,
              value: variable.value,
            }))
          )
        }
      })

      const result = await getEnvironmentWithVariables(envId)
      return c.json(result, 201)
    }
  )

  // PUT /projects/:projectId/environments/:envId
  .put(
    "/projects/:projectId/environments/:envId",
    zValidator("json", updateEnvironmentSchema),
    async (c) => {
      const user = c.var.user
      const { projectId, envId } = c.req.param()
      const body = c.req.valid("json")
      const normalizedName =
        body.name !== undefined ? normalizeEnvironmentName(body.name) : undefined
      const normalizedVariables =
        body.variables !== undefined ? normalizeVariables(body.variables) : undefined

      if (!(await assertMembership(projectId, user.id))) {
        return c.json({ error: "Project not found" }, 404)
      }

      const env = await db
        .select()
        .from(environments)
        .where(
          and(
            eq(environments.id, envId),
            eq(environments.projectId, projectId)
          )
        )
        .get()

      if (!env) return c.json({ error: "Environment not found" }, 404)

      if (normalizedName !== undefined) {
        if (!normalizedName) {
          return c.json({ error: "Environment name cannot be empty" }, 400)
        }

        if (env.isGlobal) {
          return c.json({ error: "Cannot rename Global environment" }, 400)
        }

        if (await hasEnvironmentNameConflict(projectId, normalizedName, envId)) {
          return c.json({ error: "Environment name already exists" }, 409)
        }
      }

      if (
        normalizedVariables !== undefined &&
        hasDuplicateVariableKeys(normalizedVariables)
      ) {
        return c.json({ error: "Environment variable keys must be unique" }, 400)
      }

      await db.transaction(async (tx) => {
        if (normalizedName !== undefined) {
          await tx
            .update(environments)
            .set({ name: normalizedName })
            .where(eq(environments.id, envId))
        }

        if (normalizedVariables !== undefined) {
          await tx
            .delete(envVariables)
            .where(eq(envVariables.environmentId, envId))

          if (normalizedVariables.length > 0) {
            await tx.insert(envVariables).values(
              normalizedVariables.map((variable) => ({
                id: generateId(),
                environmentId: envId,
                key: variable.key,
                value: variable.value,
              }))
            )
          }
        }
      })

      const result = await getEnvironmentWithVariables(envId)
      return c.json(result)
    }
  )

  // DELETE /projects/:projectId/environments/:envId
  .delete("/projects/:projectId/environments/:envId", async (c) => {
    const user = c.var.user
    const { projectId, envId } = c.req.param()

    if (!(await assertMembership(projectId, user.id))) {
      return c.json({ error: "Project not found" }, 404)
    }

    const env = await db
      .select()
      .from(environments)
      .where(
        and(eq(environments.id, envId), eq(environments.projectId, projectId))
      )
      .get()

    if (!env) return c.json({ error: "Environment not found" }, 404)

    if (env.isGlobal) {
      return c.json({ error: "Cannot delete Global environment" }, 400)
    }

    await db.delete(environments).where(eq(environments.id, envId))

    return c.json({ message: "Environment deleted" })
  })
