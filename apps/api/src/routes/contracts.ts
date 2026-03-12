import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { db } from "../db"
import {
  contractGroups,
  contractVersions,
  contracts,
  projectMembers,
  users,
} from "../db/schema"
import { and, desc, eq, ne } from "drizzle-orm"
import { generateId } from "../lib/id"
import { requireAuth } from "../middleware/auth"
import { computeContractDiff, generateChangeSummary } from "../lib/diff"
import type { UserRow } from "../db/schema"
import type {
  Contract,
  ContractSchema,
  HttpMethod,
  RequestBodyFormat,
  SchemaField,
} from "@repo/types"

type AuthEnv = { Variables: { user: UserRow } }

type NormalizableSchema = {
  fields: Array<{
    name: string
    type: SchemaField["type"]
    required: boolean
    description?: string | undefined
  }>
}

const schemaFieldSchema = z.object({
  name: z.string(),
  type: z.enum(["string", "number", "boolean", "object", "array", "file"]),
  required: z.boolean(),
  description: z.string().optional(),
})

const contractSchemaSchema = z.object({
  fields: z.array(schemaFieldSchema),
})

const createContractSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string().min(1),
  groupId: z.string().min(1).nullable().optional(),
  querySchema: contractSchemaSchema.optional(),
  requestBodyFormat: z.enum(["json", "form-data"]).optional(),
  requestSchema: contractSchemaSchema.optional(),
  responseSchema: contractSchemaSchema.optional(),
})

const updateContractSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional(),
  path: z.string().min(1).optional(),
  groupId: z.string().min(1).nullable().optional(),
  querySchema: contractSchemaSchema.optional(),
  requestBodyFormat: z.enum(["json", "form-data"]).optional(),
  requestSchema: contractSchemaSchema.optional(),
  responseSchema: contractSchemaSchema.optional(),
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
    .then((rows) => rows[0] ?? null)
  return !!row
}

async function assertGroupBelongsToProject(
  projectId: string,
  groupId: string
): Promise<boolean> {
  const row = await db
    .select()
    .from(contractGroups)
    .where(
      and(
        eq(contractGroups.id, groupId),
        eq(contractGroups.projectId, projectId)
      )
    )
    .then((rows) => rows[0] ?? null)
  return !!row
}

async function findDuplicateContract(
  projectId: string,
  method: HttpMethod,
  path: string,
  excludeId?: string
) {
  return db
    .select({ id: contracts.id })
    .from(contracts)
    .where(
      excludeId
        ? and(
            eq(contracts.projectId, projectId),
            eq(contracts.method, method),
            eq(contracts.path, path),
            ne(contracts.id, excludeId)
          )
        : and(
            eq(contracts.projectId, projectId),
            eq(contracts.method, method),
            eq(contracts.path, path)
          )
    )
    .then((rows) => rows[0] ?? null)
}

function getSchemaValidationError(schema: ContractSchema, label: string): string | null {
  const seen = new Set<string>()
  const fieldTypes = new Map<string, ContractSchema["fields"][number]["type"]>()

  for (const field of schema.fields) {
    const path = field.name.trim()
    if (!path) continue

    const segments = path.split(".")
    if (segments.some((segment) => !segment)) {
      return `${label}: "${path}" is not a valid path.`
    }

    if (seen.has(path)) return `${label}: duplicate field "${path}".`

    for (let depth = 1; depth < segments.length; depth += 1) {
      const parentPath = segments.slice(0, depth).join(".")
      const parentType = fieldTypes.get(parentPath)
      if (parentType && parentType !== "object") {
        return `${label}: "${parentPath}" must be type "object" before adding nested field "${path}".`
      }
    }

    for (const [existingPath, existingType] of fieldTypes) {
      if (existingPath.startsWith(`${path}.`) && field.type !== "object") {
        return `${label}: "${path}" must be type "object" because it already has nested fields.`
      }

      if (path.startsWith(`${existingPath}.`) && existingType !== "object") {
        return `${label}: "${existingPath}" must be type "object" before adding nested field "${path}".`
      }
    }

    seen.add(path)
    fieldTypes.set(path, field.type)
  }

  return null
}

function normalizeSchema(schema: NormalizableSchema): ContractSchema {
  const fields: SchemaField[] = schema.fields.map((field) => {
    const nextField: SchemaField = {
      name: field.name,
      type: field.type,
      required: field.required,
    }

    if (field.description) {
      nextField.description = field.description
    }

    return nextField
  })

  return {
    fields: fields
      .map((field) => ({ ...field, name: field.name.trim() }))
      .filter((field) => field.name.length > 0),
  }
}

async function insertContractVersionWithRetry(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  contractId: string,
  changedBy: string,
  changeSummary: string,
  snapshot: Contract,
  diff: ReturnType<typeof computeContractDiff>
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const lastVersion = await tx
      .select({ version: contractVersions.version })
      .from(contractVersions)
      .where(eq(contractVersions.contractId, contractId))
      .orderBy(desc(contractVersions.version))
      .limit(1)
      .then((rows) => rows[0] ?? null)

    try {
      await tx.insert(contractVersions).values({
        id: generateId(),
        contractId,
        version: (lastVersion?.version ?? 0) + 1,
        changedBy,
        changeSummary,
        snapshot: JSON.stringify(snapshot),
        diff: diff ? JSON.stringify(diff) : null,
      })
      return
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("contract_versions_contract_version_unique") &&
        attempt < 2
      ) {
        continue
      }
      throw error
    }
  }
}

function deriveContractName(method: HttpMethod, path: string): string {
  return `${method} ${path}`
}

function rowToContract(row: typeof contracts.$inferSelect): Contract {
  return {
    id: row.id,
    projectId: row.projectId,
    groupId: row.groupId,
    name: row.name,
    method: row.method as Contract["method"],
    path: row.path,
    status: row.status as Contract["status"],
    querySchema: JSON.parse(row.querySchema) as ContractSchema,
    requestBodyFormat: row.requestBodyFormat as RequestBodyFormat,
    requestSchema: JSON.parse(row.requestSchema) as ContractSchema,
    responseSchema: JSON.parse(row.responseSchema) as ContractSchema,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export const contractRoutes = new Hono<AuthEnv>()

  .use(requireAuth)

  // GET /projects/:projectId/contracts
  .get("/projects/:projectId/contracts", async (c) => {
    const user = c.var.user
    const { projectId } = c.req.param()

    if (!(await assertMembership(projectId, user.id))) {
      return c.json({ error: "Project not found" }, 404)
    }

    const rows = await db
      .select()
      .from(contracts)
      .where(eq(contracts.projectId, projectId))

    return c.json(rows.map(rowToContract))
  })

  // POST /projects/:projectId/contracts
  .post(
    "/projects/:projectId/contracts",
    zValidator("json", createContractSchema),
    async (c) => {
      const user = c.var.user
      const { projectId } = c.req.param()
      const body = c.req.valid("json")
      const normalizedPath = body.path.trim()

      if (!(await assertMembership(projectId, user.id))) {
        return c.json({ error: "Project not found" }, 404)
      }

      if (!normalizedPath) {
        return c.json({ error: "Path cannot be empty" }, 400)
      }

      if (
        body.groupId !== undefined &&
        body.groupId !== null &&
        !(await assertGroupBelongsToProject(projectId, body.groupId))
      ) {
        return c.json({ error: "Group not found" }, 400)
      }

      const contractId = generateId()
      const querySchema = normalizeSchema(body.querySchema ?? { fields: [] })
      const requestBodyFormat = body.requestBodyFormat ?? "json"
      const requestSchema = normalizeSchema(body.requestSchema ?? { fields: [] })
      const responseSchema = normalizeSchema(body.responseSchema ?? { fields: [] })

      const querySchemaError = getSchemaValidationError(querySchema, "Query")
      if (querySchemaError) {
        return c.json({ error: querySchemaError }, 400)
      }

      const requestSchemaError = getSchemaValidationError(requestSchema, "Request Body")
      if (requestSchemaError) {
        return c.json({ error: requestSchemaError }, 400)
      }

      const responseSchemaError = getSchemaValidationError(responseSchema, "Response")
      if (responseSchemaError) {
        return c.json({ error: responseSchemaError }, 400)
      }

      if (await findDuplicateContract(projectId, body.method, normalizedPath)) {
        return c.json(
          { error: "An endpoint with this method and path already exists" },
          409
        )
      }

      await db.transaction(async (tx) => {
        await tx.insert(contracts).values({
          id: contractId,
          projectId,
          name: deriveContractName(body.method, normalizedPath),
          method: body.method,
          path: normalizedPath,
          groupId: body.groupId ?? null,
          status: "draft",
          requestBodyFormat,
          querySchema: JSON.stringify(querySchema),
          requestSchema: JSON.stringify(requestSchema),
          responseSchema: JSON.stringify(responseSchema),
        })

        const createdRow = await tx
          .select()
          .from(contracts)
          .where(eq(contracts.id, contractId))
          .then((rows) => rows[0] ?? null)

        if (!createdRow) {
          throw new Error("Failed to create contract")
        }

        await tx.insert(contractVersions).values({
          id: generateId(),
          contractId,
          version: 1,
          changedBy: user.id,
          changeSummary: "Initial version",
          snapshot: JSON.stringify(rowToContract(createdRow)),
          diff: null,
        })
      })

      const row = await db
        .select()
        .from(contracts)
        .where(eq(contracts.id, contractId))
        .then((rows) => rows[0] ?? null)

      if (!row) return c.json({ error: "Failed to create contract" }, 500)

      return c.json(rowToContract(row), 201)
    }
  )

  // GET /projects/:projectId/contracts/:contractId
  .get("/projects/:projectId/contracts/:contractId", async (c) => {
    const user = c.var.user
    const { projectId, contractId } = c.req.param()

    if (!(await assertMembership(projectId, user.id))) {
      return c.json({ error: "Project not found" }, 404)
    }

    const row = await db
      .select()
      .from(contracts)
      .where(
        and(eq(contracts.id, contractId), eq(contracts.projectId, projectId))
      )
      .then((rows) => rows[0] ?? null)

    if (!row) return c.json({ error: "Contract not found" }, 404)

    return c.json(rowToContract(row))
  })

  // PUT /projects/:projectId/contracts/:contractId — manual save
  .put(
    "/projects/:projectId/contracts/:contractId",
    zValidator("json", updateContractSchema),
    async (c) => {
      const user = c.var.user
      const { projectId, contractId } = c.req.param()
      const body = c.req.valid("json")

      if (!(await assertMembership(projectId, user.id))) {
        return c.json({ error: "Project not found" }, 404)
      }

      const existing = await db
        .select()
        .from(contracts)
        .where(
          and(eq(contracts.id, contractId), eq(contracts.projectId, projectId))
        )
        .then((rows) => rows[0] ?? null)

      if (!existing) return c.json({ error: "Contract not found" }, 404)

      if (
        body.groupId !== undefined &&
        body.groupId !== null &&
        !(await assertGroupBelongsToProject(projectId, body.groupId))
      ) {
        return c.json({ error: "Group not found" }, 400)
      }

      const normalizedPath = body.path?.trim()
      if (body.path !== undefined && !normalizedPath) {
        return c.json({ error: "Path cannot be empty" }, 400)
      }

      const nextMethod = (body.method ?? existing.method) as HttpMethod
      const nextPath = normalizedPath ?? existing.path
      const nextRequestBodyFormat = body.requestBodyFormat ?? (existing.requestBodyFormat as RequestBodyFormat)
      const nextQuerySchema = normalizeSchema(
        body.querySchema ?? (JSON.parse(existing.querySchema) as ContractSchema)
      )
      const nextRequestSchema = normalizeSchema(
        body.requestSchema ?? (JSON.parse(existing.requestSchema) as ContractSchema)
      )
      const nextResponseSchema = normalizeSchema(
        body.responseSchema ?? (JSON.parse(existing.responseSchema) as ContractSchema)
      )

      const querySchemaError = getSchemaValidationError(nextQuerySchema, "Query")
      if (querySchemaError) {
        return c.json({ error: querySchemaError }, 400)
      }

      const requestSchemaError = getSchemaValidationError(nextRequestSchema, "Request Body")
      if (requestSchemaError) {
        return c.json({ error: requestSchemaError }, 400)
      }

      const responseSchemaError = getSchemaValidationError(nextResponseSchema, "Response")
      if (responseSchemaError) {
        return c.json({ error: responseSchemaError }, 400)
      }

      if (await findDuplicateContract(projectId, nextMethod, nextPath, contractId)) {
        return c.json(
          { error: "An endpoint with this method and path already exists" },
          409
        )
      }

      const before = rowToContract(existing)
      const updatedAt = new Date().toISOString()

      let updatedRow: typeof contracts.$inferSelect | null | undefined

      await db.transaction(async (tx) => {
        await tx
          .update(contracts)
          .set({
            ...(body.method !== undefined && { method: body.method }),
            ...(normalizedPath !== undefined && { path: normalizedPath }),
            name: deriveContractName(nextMethod, nextPath),
            ...(body.groupId !== undefined && { groupId: body.groupId }),
            ...(body.requestBodyFormat !== undefined && {
              requestBodyFormat: nextRequestBodyFormat,
            }),
            ...(body.querySchema !== undefined && {
              querySchema: JSON.stringify(nextQuerySchema),
            }),
            ...(body.requestSchema !== undefined && {
              requestSchema: JSON.stringify(nextRequestSchema),
            }),
            ...(body.responseSchema !== undefined && {
              responseSchema: JSON.stringify(nextResponseSchema),
            }),
            updatedAt,
          })
          .where(eq(contracts.id, contractId))

        updatedRow = await tx
          .select()
          .from(contracts)
          .where(eq(contracts.id, contractId))
          .then((rows) => rows[0] ?? null)

        if (!updatedRow) {
          throw new Error("Failed to update")
        }

        const after = rowToContract(updatedRow)
        const diff = computeContractDiff(before, after)

        if (!diff) {
          return
        }

        await insertContractVersionWithRetry(
          tx,
          contractId,
          user.id,
          generateChangeSummary(diff, false),
          after,
          diff
        )
      })

      if (!updatedRow) return c.json({ error: "Failed to update" }, 500)

      const after = rowToContract(updatedRow)

      return c.json(after)
    }
  )

  // PATCH /projects/:projectId/contracts/:contractId/status
  .patch(
    "/projects/:projectId/contracts/:contractId/status",
    zValidator("json", z.object({ status: z.enum(["draft", "approved"]) })),
    async (c) => {
      const user = c.var.user
      const { projectId, contractId } = c.req.param()
      const { status } = c.req.valid("json")

      if (!(await assertMembership(projectId, user.id))) {
        return c.json({ error: "Project not found" }, 404)
      }

      const existing = await db
        .select()
        .from(contracts)
        .where(
          and(eq(contracts.id, contractId), eq(contracts.projectId, projectId))
        )
        .then((rows) => rows[0] ?? null)

      if (!existing) return c.json({ error: "Contract not found" }, 404)

      if (existing.status === status) {
        return c.json({ status })
      }

      const before = rowToContract(existing)
      let updatedRow: typeof contracts.$inferSelect | null | undefined

      await db.transaction(async (tx) => {
        await tx
          .update(contracts)
          .set({ status, updatedAt: new Date().toISOString() })
          .where(eq(contracts.id, contractId))

        updatedRow = await tx
          .select()
          .from(contracts)
          .where(eq(contracts.id, contractId))
          .then((rows) => rows[0] ?? null)

        if (!updatedRow) {
          throw new Error("Failed to update contract status")
        }

        const after = rowToContract(updatedRow)
        const diff = computeContractDiff(before, after)

        if (!diff) {
          return
        }

        await insertContractVersionWithRetry(
          tx,
          contractId,
          user.id,
          generateChangeSummary(diff, false),
          after,
          diff
        )
      })

      return c.json({ status })
    }
  )

  // DELETE /projects/:projectId/contracts/:contractId
  .delete("/projects/:projectId/contracts/:contractId", async (c) => {
    const user = c.var.user
    const { projectId, contractId } = c.req.param()

    if (!(await assertMembership(projectId, user.id))) {
      return c.json({ error: "Project not found" }, 404)
    }

    const existing = await db
      .select()
      .from(contracts)
      .where(
        and(eq(contracts.id, contractId), eq(contracts.projectId, projectId))
      )
      .then((rows) => rows[0] ?? null)

    if (!existing) return c.json({ error: "Contract not found" }, 404)

    await db.delete(contracts).where(eq(contracts.id, contractId))

    return c.json({ message: "Contract deleted" })
  })

  // GET /projects/:projectId/contracts/:contractId/versions
  .get(
    "/projects/:projectId/contracts/:contractId/versions",
    async (c) => {
      const user = c.var.user
      const { projectId, contractId } = c.req.param()

      if (!(await assertMembership(projectId, user.id))) {
        return c.json({ error: "Project not found" }, 404)
      }

      const contract = await db
        .select({ id: contracts.id })
        .from(contracts)
        .where(
          and(eq(contracts.id, contractId), eq(contracts.projectId, projectId))
        )
        .then((rows) => rows[0] ?? null)

      if (!contract) {
        return c.json({ error: "Contract not found" }, 404)
      }

      const versions = await db
        .select({
          id: contractVersions.id,
          contractId: contractVersions.contractId,
          version: contractVersions.version,
          changedBy: contractVersions.changedBy,
          changedAt: contractVersions.changedAt,
          changeSummary: contractVersions.changeSummary,
          snapshot: contractVersions.snapshot,
          diff: contractVersions.diff,
          changedByUser: {
            id: users.id,
            name: users.name,
            email: users.email,
          },
        })
        .from(contractVersions)
        .innerJoin(users, eq(contractVersions.changedBy, users.id))
        .where(eq(contractVersions.contractId, contractId))
        .orderBy(desc(contractVersions.version))

      return c.json(
        versions.map((v) => ({
          ...v,
          snapshot: JSON.parse(v.snapshot),
          diff: v.diff ? JSON.parse(v.diff) : null,
        }))
      )
    }
  )

  // GET /projects/:projectId/contracts/:contractId/versions/:versionId
  .get(
    "/projects/:projectId/contracts/:contractId/versions/:versionId",
    async (c) => {
      const user = c.var.user
      const { projectId, contractId, versionId } = c.req.param()

      if (!(await assertMembership(projectId, user.id))) {
        return c.json({ error: "Project not found" }, 404)
      }

      const contract = await db
        .select({ id: contracts.id })
        .from(contracts)
        .where(
          and(eq(contracts.id, contractId), eq(contracts.projectId, projectId))
        )
        .then((rows) => rows[0] ?? null)

      if (!contract) {
        return c.json({ error: "Contract not found" }, 404)
      }

      const version = await db
        .select({
          id: contractVersions.id,
          contractId: contractVersions.contractId,
          version: contractVersions.version,
          changedBy: contractVersions.changedBy,
          changedAt: contractVersions.changedAt,
          changeSummary: contractVersions.changeSummary,
          snapshot: contractVersions.snapshot,
          diff: contractVersions.diff,
          changedByUser: {
            id: users.id,
            name: users.name,
            email: users.email,
          },
        })
        .from(contractVersions)
        .innerJoin(users, eq(contractVersions.changedBy, users.id))
        .where(
          and(
            eq(contractVersions.id, versionId),
            eq(contractVersions.contractId, contractId)
          )
        )
        .then((rows) => rows[0] ?? null)

      if (!version) return c.json({ error: "Version not found" }, 404)

      return c.json({
        ...version,
        snapshot: JSON.parse(version.snapshot),
        diff: version.diff ? JSON.parse(version.diff) : null,
      })
    }
  )
