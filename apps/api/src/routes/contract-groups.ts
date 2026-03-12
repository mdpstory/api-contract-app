import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { db } from "../db"
import { contractGroups, contracts, projectMembers } from "../db/schema"
import { generateId } from "../lib/id"
import { requireAuth } from "../middleware/auth"
import type { UserRow } from "../db/schema"

type AuthEnv = { Variables: { user: UserRow } }

const createContractGroupSchema = z.object({
  name: z.string().min(1).max(100),
})

const updateContractGroupSchema = z.object({
  name: z.string().min(1).max(100),
})

const deleteContractGroupSchema = z.object({
  confirmName: z.string().min(1),
})

function isUniqueConstraintError(error: unknown, constraintName: string): boolean {
  if (!(error instanceof Error)) return false

  return (
    error.message.includes("UNIQUE constraint failed") ||
    error.message.includes("duplicate key value") ||
    error.message.includes(constraintName)
  )
}

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
    .then((rows) => rows[0] ?? null)
  return !!row
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export const contractGroupRoutes = new Hono<AuthEnv>()

  .use(requireAuth)

  // GET /projects/:projectId/contract-groups
  .get("/projects/:projectId/contract-groups", async (c) => {
    const user = c.var.user
    const { projectId } = c.req.param()

    if (!(await assertMembership(projectId, user.id))) {
      return c.json({ error: "Project not found" }, 404)
    }

    const groups = await db
      .select()
      .from(contractGroups)
      .where(eq(contractGroups.projectId, projectId))

    const groupedContracts = await db
      .select({ groupId: contracts.groupId })
      .from(contracts)
      .where(eq(contracts.projectId, projectId))

    const countByGroupId = new Map<string, number>()
    for (const row of groupedContracts) {
      if (!row.groupId) continue
      countByGroupId.set(row.groupId, (countByGroupId.get(row.groupId) ?? 0) + 1)
    }

    return c.json(
      groups.map((group) => ({
        ...group,
        endpointCount: countByGroupId.get(group.id) ?? 0,
      }))
    )
  })

  // POST /projects/:projectId/contract-groups
  .post(
    "/projects/:projectId/contract-groups",
    zValidator("json", createContractGroupSchema),
    async (c) => {
      const user = c.var.user
      const { projectId } = c.req.param()
      const body = c.req.valid("json")
      const name = body.name.trim()

      if (!(await assertMembership(projectId, user.id))) {
        return c.json({ error: "Project not found" }, 404)
      }

      if (!name) {
        return c.json({ error: "Group name cannot be empty" }, 400)
      }

      const id = generateId()

      try {
        await db.insert(contractGroups).values({
          id,
          projectId,
          name,
        })
      } catch (error) {
        if (isUniqueConstraintError(error, "contract_groups_project_name_unique")) {
          return c.json({ error: "Group name already exists" }, 409)
        }
        throw error
      }

      const created = await db
        .select()
        .from(contractGroups)
        .where(eq(contractGroups.id, id))
        .then((rows) => rows[0] ?? null)

      if (!created) {
        return c.json({ error: "Failed to create group" }, 500)
      }

      return c.json({ ...created, endpointCount: 0 }, 201)
    }
  )

  // PUT /projects/:projectId/contract-groups/:groupId
  .put(
    "/projects/:projectId/contract-groups/:groupId",
    zValidator("json", updateContractGroupSchema),
    async (c) => {
      const user = c.var.user
      const { projectId, groupId } = c.req.param()
      const body = c.req.valid("json")
      const name = body.name.trim()

      if (!(await assertMembership(projectId, user.id))) {
        return c.json({ error: "Project not found" }, 404)
      }

      const existing = await db
        .select()
        .from(contractGroups)
        .where(
          and(
            eq(contractGroups.id, groupId),
            eq(contractGroups.projectId, projectId)
          )
        )
        .then((rows) => rows[0] ?? null)

      if (!existing) {
        return c.json({ error: "Group not found" }, 404)
      }

      if (!name) {
        return c.json({ error: "Group name cannot be empty" }, 400)
      }

      if (name !== existing.name) {
        try {
          await db
            .update(contractGroups)
            .set({ name })
            .where(eq(contractGroups.id, groupId))
        } catch (error) {
          if (isUniqueConstraintError(error, "contract_groups_project_name_unique")) {
            return c.json({ error: "Group name already exists" }, 409)
          }
          throw error
        }
      }

      const updated = await db
        .select()
        .from(contractGroups)
        .where(eq(contractGroups.id, groupId))
        .then((rows) => rows[0] ?? null)

      if (!updated) {
        return c.json({ error: "Failed to update group" }, 500)
      }

      const groupedContracts = await db
        .select({ id: contracts.id })
        .from(contracts)
        .where(
          and(eq(contracts.projectId, projectId), eq(contracts.groupId, groupId))
        )

      return c.json({
        ...updated,
        endpointCount: groupedContracts.length,
      })
    }
  )

  // DELETE /projects/:projectId/contract-groups/:groupId
  .delete(
    "/projects/:projectId/contract-groups/:groupId",
    zValidator("json", deleteContractGroupSchema),
    async (c) => {
      const user = c.var.user
      const { projectId, groupId } = c.req.param()
      const { confirmName } = c.req.valid("json")

      if (!(await assertMembership(projectId, user.id))) {
        return c.json({ error: "Project not found" }, 404)
      }

      const group = await db
        .select()
        .from(contractGroups)
        .where(
          and(
            eq(contractGroups.id, groupId),
            eq(contractGroups.projectId, projectId)
          )
        )
        .then((rows) => rows[0] ?? null)

      if (!group) {
        return c.json({ error: "Group not found" }, 404)
      }

      if (confirmName.trim() !== group.name) {
        return c.json({ error: "Group name confirmation mismatch" }, 400)
      }

      let deletedEndpointCount = 0

      await db.transaction(async (tx) => {
        const groupedContracts = await tx
          .select({ id: contracts.id })
          .from(contracts)
          .where(
            and(eq(contracts.projectId, projectId), eq(contracts.groupId, groupId))
          )

        deletedEndpointCount = groupedContracts.length

        // Legacy databases were migrated without ON DELETE CASCADE on contracts.group_id,
        // so remove child contracts explicitly before deleting the group.
        if (deletedEndpointCount > 0) {
          await tx
            .delete(contracts)
            .where(
              and(eq(contracts.projectId, projectId), eq(contracts.groupId, groupId))
            )
        }

        await tx
          .delete(contractGroups)
          .where(
            and(
              eq(contractGroups.id, groupId),
              eq(contractGroups.projectId, projectId)
            )
          )
      })

      return c.json({
        message: "Group deleted",
        deletedEndpointCount,
      })
    }
  )
