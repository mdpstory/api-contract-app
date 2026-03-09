import { Hono } from "hono"
import { db } from "../db"
import { contracts, projectMembers } from "../db/schema"
import { and, eq } from "drizzle-orm"
import { requireAuth } from "../middleware/auth"
import type { UserRow } from "../db/schema"
import type { ContractSchema, FieldType } from "@repo/types"

type AuthEnv = { Variables: { user: UserRow } }

// ─── OpenAPI helpers ──────────────────────────────────────────────────────────

function fieldTypeToOpenApi(type: FieldType): Record<string, string> {
  if (type === "file") {
    return { type: "string", format: "binary" }
  }

  const map: Record<Exclude<FieldType, "file">, string> = {
    string: "string",
    number: "number",
    boolean: "boolean",
    object: "object",
    array: "array",
  }
  return { type: map[type] }
}

interface OpenApiSchemaNode {
  type?: FieldType
  required: boolean
  description?: string
  children: Map<string, OpenApiSchemaNode>
}

function createOpenApiNode(): OpenApiSchemaNode {
  return {
    required: false,
    children: new Map(),
  }
}

function splitFieldPath(path: string): string[] {
  return path
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean)
}

function buildOpenApiTree(schema: ContractSchema): OpenApiSchemaNode {
  const root = createOpenApiNode()

  for (const field of schema.fields) {
    const segments = splitFieldPath(field.name)
    if (segments.length === 0) continue

    let current = root
    for (const segment of segments) {
      let next = current.children.get(segment)
      if (!next) {
        next = createOpenApiNode()
        current.children.set(segment, next)
      }
      current = next
    }

    current.type = field.type
    current.required = current.required || field.required
    if (field.description !== undefined) {
      current.description = field.description
    }

    if (field.required && segments.length > 1) {
      let ancestor = root
      for (const segment of segments.slice(0, -1)) {
        const next = ancestor.children.get(segment)
        if (!next) break
        next.required = true
        ancestor = next
      }
    }
  }

  return root
}

function nodeToOpenApiSchema(node: OpenApiSchemaNode): Record<string, unknown> {
  const hasChildren = node.children.size > 0
  const effectiveType: FieldType = hasChildren ? "object" : (node.type ?? "object")

  if (effectiveType !== "object") {
    return {
      ...fieldTypeToOpenApi(effectiveType),
      ...(node.description ? { description: node.description } : {}),
    }
  }

  const properties: Record<string, unknown> = {}
  const required: string[] = []

  for (const [name, child] of node.children) {
    properties[name] = nodeToOpenApiSchema(child)
    if (child.required) {
      required.push(name)
    }
  }

  return {
    type: "object",
    ...(node.description ? { description: node.description } : {}),
    properties,
    ...(required.length > 0 ? { required } : {}),
  }
}

function schemaToOpenApi(schema: ContractSchema): Record<string, unknown> {
  return nodeToOpenApiSchema(buildOpenApiTree(schema))
}

function schemaFieldToParameter(
  name: string,
  location: "path" | "query",
  required: boolean,
  type: ContractSchema["fields"][number]["type"] = "string"
): Record<string, unknown> {
  return {
    name,
    in: location,
    required,
    schema: {
      ...(type === "file"
        ? { type: "string", format: "binary" }
        : { type: type === "object" ? "string" : type }),
    },
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export const exportRoutes = new Hono<AuthEnv>()

  .use(requireAuth)

  // GET /projects/:projectId/contracts/:contractId/export/openapi
  .get(
    "/projects/:projectId/contracts/:contractId/export/openapi",
    async (c) => {
      const user = c.var.user
      const { projectId, contractId } = c.req.param()

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

      if (!membership) return c.json({ error: "Project not found" }, 404)

      const contract = await db
        .select()
        .from(contracts)
        .where(
          and(
            eq(contracts.id, contractId),
            eq(contracts.projectId, projectId)
          )
        )
        .get()

      if (!contract) return c.json({ error: "Contract not found" }, 404)

      const querySchema = JSON.parse(
        contract.querySchema
      ) as ContractSchema
      const requestBodyFormat = contract.requestBodyFormat as "json" | "form-data"
      const requestSchema = JSON.parse(
        contract.requestSchema
      ) as ContractSchema
      const responseSchema = JSON.parse(
        contract.responseSchema
      ) as ContractSchema

      const methodLower = contract.method.toLowerCase()
      const hasBody = ["post", "put", "patch"].includes(methodLower)
      const contractLabel = `${contract.method} ${contract.path}`
      const pathParameters = Array.from(contract.path.matchAll(/:([A-Za-z0-9_]+)/g)).map((match) =>
        schemaFieldToParameter(match[1] ?? "param", "path", true)
      )
      const queryParameters = querySchema.fields.map((field) =>
        schemaFieldToParameter(field.name, "query", field.required, field.type)
      )
      const parameters = [...pathParameters, ...queryParameters]
      const fileBase = `${contract.method}-${contract.path}`
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() || "contract"

      const operation: Record<string, unknown> = {
        summary: contractLabel,
        operationId: contract.id,
        ...(parameters.length > 0 ? { parameters } : {}),
        ...(hasBody && {
          requestBody: {
            required: true,
            content: {
              [requestBodyFormat === "form-data" ? "multipart/form-data" : "application/json"]: {
                schema: schemaToOpenApi(requestSchema),
              },
            },
          },
        }),
        responses: {
          "200": {
            description: "Successful response",
            content: {
              "application/json": {
                schema: schemaToOpenApi(responseSchema),
              },
            },
          },
        },
      }

      const openapi = {
        openapi: "3.0.3",
        info: {
          title: contractLabel,
          version: "1.0.0",
        },
        paths: {
          [contract.path]: {
            [methodLower]: operation,
          },
        },
      }

      c.header(
        "Content-Disposition",
        `attachment; filename="${fileBase}-openapi.json"`
      )
      c.header("Content-Type", "application/json")

      return c.json(openapi)
    }
  )
