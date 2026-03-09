import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { db } from "../db"
import { environments, projectMembers, projects, users } from "../db/schema"
import { and, eq } from "drizzle-orm"
import { generateId } from "../lib/id"
import { requireAuth } from "../middleware/auth"
import type { UserRow } from "../db/schema"

type AuthEnv = { Variables: { user: UserRow } }

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
})

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
})

const deleteProjectSchema = z.object({
  confirmName: z.string().min(1),
})

const inviteMemberSchema = z.object({
  email: z.string().email(),
})

export const projectRoutes = new Hono<AuthEnv>()

  .use(requireAuth)

  // GET /projects — list all projects for current user
  .get("/", async (c) => {
    const user = c.var.user

    const rows = await db
      .select({ project: projects })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(eq(projectMembers.userId, user.id))

    return c.json(rows.map((r) => r.project))
  })

  // POST /projects — create a new project
  .post("/", zValidator("json", createProjectSchema), async (c) => {
    const user = c.var.user
    const body = c.req.valid("json")
    const name = body.name.trim()

    const projectId = generateId()

    if (!name) {
      return c.json({ error: "Project name cannot be empty" }, 400)
    }

    await db.transaction(async (tx) => {
      await tx.insert(projects).values({
        id: projectId,
        name,
        description: body.description ?? null,
        ownerId: user.id,
      })

      await tx.insert(projectMembers).values({
        projectId,
        userId: user.id,
        role: "owner",
      })

      await tx.insert(environments).values({
        id: generateId(),
        projectId,
        name: "Global",
        isGlobal: true,
      })
    })

    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .get()

    return c.json(project, 201)
  })

  // GET /projects/:id
  .get("/:id", async (c) => {
    const user = c.var.user
    const projectId = c.req.param("id")

    const membership = await db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, user.id)
        )
      )
      .get()

    if (!membership) {
      return c.json({ error: "Project not found" }, 404)
    }

    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .get()

    return c.json(project)
  })

  // PUT /projects/:id
  .put("/:id", zValidator("json", updateProjectSchema), async (c) => {
    const user = c.var.user
    const projectId = c.req.param("id")
    const body = c.req.valid("json")

    const membership = await db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, user.id)
        )
      )
      .get()

    if (!membership || membership.role !== "owner") {
      return c.json({ error: "Forbidden" }, 403)
    }

    await db
      .update(projects)
      .set({
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
      })
      .where(eq(projects.id, projectId))

    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .get()

    return c.json(project)
  })

  // DELETE /projects/:id
  .delete("/:id", zValidator("json", deleteProjectSchema), async (c) => {
    const user = c.var.user
    const projectId = c.req.param("id")
    const { confirmName } = c.req.valid("json")

    const membership = await db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, user.id)
        )
      )
      .get()

    if (!membership || membership.role !== "owner") {
      return c.json({ error: "Forbidden" }, 403)
    }

    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .get()

    if (!project) {
      return c.json({ error: "Project not found" }, 404)
    }

    if (confirmName.trim() !== project.name) {
      return c.json({ error: "Project name confirmation mismatch" }, 400)
    }

    await db.delete(projects).where(eq(projects.id, projectId))

    return c.json({ message: "Project deleted" })
  })

  // GET /projects/:id/members
  .get("/:id/members", async (c) => {
    const user = c.var.user
    const projectId = c.req.param("id")

    const membership = await db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, user.id)
        )
      )
      .get()

    if (!membership) {
      return c.json({ error: "Project not found" }, 404)
    }

    const members = await db
      .select({
        projectId: projectMembers.projectId,
        userId: projectMembers.userId,
        role: projectMembers.role,
        joinedAt: projectMembers.joinedAt,
        user: {
          id: users.id,
          email: users.email,
          name: users.name,
        },
      })
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .where(eq(projectMembers.projectId, projectId))

    return c.json(members)
  })

  // POST /projects/:id/members — invite by email
  .post(
    "/:id/members",
    zValidator("json", inviteMemberSchema),
    async (c) => {
      const user = c.var.user
      const projectId = c.req.param("id")
      const { email } = c.req.valid("json")

      const membership = await db
        .select()
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, projectId),
            eq(projectMembers.userId, user.id)
          )
        )
        .get()

      if (!membership || membership.role !== "owner") {
        return c.json({ error: "Forbidden" }, 403)
      }

      // Find user by email
      const invitee = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .get()

      if (!invitee) {
        return c.json({ error: "User not found. They need to sign up first." }, 404)
      }

      // Check if already a member
      const existing = await db
        .select()
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, projectId),
            eq(projectMembers.userId, invitee.id)
          )
        )
        .get()

      if (existing) {
        return c.json({ error: "User is already a member" }, 409)
      }

      await db.insert(projectMembers).values({
        projectId,
        userId: invitee.id,
        role: "member",
      })

      return c.json({ message: "Member added" }, 201)
    }
  )

  // DELETE /projects/:id/members/:userId
  .delete("/:id/members/:userId", async (c) => {
    const user = c.var.user
    const projectId = c.req.param("id")
    const targetUserId = c.req.param("userId")

    const membership = await db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, user.id)
        )
      )
      .get()

    if (!membership || membership.role !== "owner") {
      return c.json({ error: "Forbidden" }, 403)
    }

    if (targetUserId === user.id) {
      return c.json({ error: "Cannot remove yourself as owner" }, 400)
    }

    const targetMembership = await db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, targetUserId)
        )
      )
      .get()

    if (!targetMembership) {
      return c.json({ error: "Member not found" }, 404)
    }

    await db
      .delete(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, targetUserId)
        )
      )

    return c.json({ message: "Member removed" })
  })
