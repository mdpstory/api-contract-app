import type { ContractSchema, FieldType, HttpMethod } from "@repo/types"

// ─── Helpers (mirrors apps/api/src/routes/export.ts) ─────────────────────────

function fieldTypeToOpenApi(type: FieldType): Record<string, string> {
  if (type === "file") return { type: "string", format: "binary" }
  const map: Record<Exclude<FieldType, "file">, string> = {
    string: "string",
    number: "number",
    boolean: "boolean",
    object: "object",
    array: "array",
  }
  return { type: map[type] }
}

interface OpenApiNode {
  type?: FieldType
  required: boolean
  description?: string
  children: Map<string, OpenApiNode>
}

function createNode(): OpenApiNode {
  return { required: false, children: new Map() }
}

function buildTree(schema: ContractSchema): OpenApiNode {
  const root = createNode()
  for (const field of schema.fields) {
    const segments = field.name.split(".").map((s) => s.trim()).filter(Boolean)
    if (segments.length === 0) continue
    let cur = root
    for (const seg of segments) {
      let next = cur.children.get(seg)
      if (!next) { next = createNode(); cur.children.set(seg, next) }
      cur = next
    }
    cur.type = field.type
    cur.required = cur.required || field.required
    if (field.description) cur.description = field.description
    if (field.required && segments.length > 1) {
      let ancestor = root
      for (const seg of segments.slice(0, -1)) {
        const next = ancestor.children.get(seg)
        if (!next) break
        next.required = true
        ancestor = next
      }
    }
  }
  return root
}

function nodeToSchema(node: OpenApiNode): Record<string, unknown> {
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
    properties[name] = nodeToSchema(child)
    if (child.required) required.push(name)
  }
  return {
    type: "object",
    ...(node.description ? { description: node.description } : {}),
    properties,
    ...(required.length > 0 ? { required } : {}),
  }
}

function schemaToOpenApi(schema: ContractSchema): Record<string, unknown> {
  return nodeToSchema(buildTree(schema))
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ContractOpenApiInput {
  method: HttpMethod
  path: string
  querySchema: ContractSchema
  parametersSchema: ContractSchema
  headersSchema: ContractSchema
  authSchema: ContractSchema
  requestBodyFormat: "json" | "form-data"
  requestSchema: ContractSchema
  responseSchema: ContractSchema
}

export function generateOpenApiObject(input: ContractOpenApiInput): Record<string, unknown> {
  const {
    method, path,
    querySchema, parametersSchema, headersSchema, authSchema,
    requestBodyFormat, requestSchema, responseSchema,
  } = input

  const methodLower = method.toLowerCase()
  const hasBody = ["post", "put", "patch"].includes(methodLower)
  const contractLabel = `${method} ${path || "/your/path"}`

  // Path parameters from :param or {param} syntax
  const pathParams = [
    ...Array.from((path || "").matchAll(/:([A-Za-z0-9_]+)/g)),
    ...Array.from((path || "").matchAll(/\{([^}]+)\}/g)),
  ].map((m) => ({
    name: m[1] ?? "param",
    in: "path",
    required: true,
    schema: { type: "string" },
  }))

  // Explicit parameters schema
  const explicitParams = parametersSchema.fields.map((f) => ({
    name: f.name,
    in: "path",
    required: f.required,
    schema: { type: f.type === "number" ? "number" : f.type === "boolean" ? "boolean" : "string" },
    ...(f.description ? { description: f.description } : {}),
  }))

  const queryParams = querySchema.fields.map((f) => ({
    name: f.name,
    in: "query",
    required: f.required,
    schema: fieldTypeToOpenApi(f.type),
    ...(f.description ? { description: f.description } : {}),
  }))

  const headerParams = headersSchema.fields.map((f) => ({
    name: f.name,
    in: "header",
    required: f.required,
    schema: { type: "string" },
    ...(f.description ? { description: f.description } : {}),
  }))

  // Auth fields as security scheme description comment (OpenAPI doesn't have a direct field)
  const authSecurityNote = authSchema.fields.length > 0
    ? { "x-auth-fields": authSchema.fields.map((f) => f.name) }
    : {}

  const parameters = [...pathParams, ...explicitParams, ...queryParams, ...headerParams]

  const operation: Record<string, unknown> = {
    summary: contractLabel,
    ...(parameters.length > 0 ? { parameters } : {}),
    ...authSecurityNote,
    ...(hasBody ? {
      requestBody: {
        required: true,
        content: {
          [requestBodyFormat === "form-data" ? "multipart/form-data" : "application/json"]: {
            schema: schemaToOpenApi(requestSchema),
          },
        },
      },
    } : {}),
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

  return {
    openapi: "3.0.3",
    info: { title: contractLabel, version: "1.0.0" },
    paths: {
      [path || "/"]: {
        [methodLower]: operation,
      },
    },
  }
}

// ─── Multi-contract (project-wide) OpenAPI generator ─────────────────────────

export function generateProjectOpenApiObject(
  contracts: ContractOpenApiInput[],
  title = "Project API"
): Record<string, unknown> {
  const paths: Record<string, unknown> = {}

  for (const input of contracts) {
    const {
      method, path,
      querySchema, parametersSchema, headersSchema, authSchema,
      requestBodyFormat, requestSchema, responseSchema,
    } = input

    const methodLower = method.toLowerCase()
    const hasBody = ["post", "put", "patch"].includes(methodLower)
    const contractLabel = `${method} ${path || "/"}`

    const pathParams = [
      ...Array.from((path || "").matchAll(/:([A-Za-z0-9_]+)/g)),
      ...Array.from((path || "").matchAll(/\{([^}]+)\}/g)),
    ].map((m) => ({
      name: m[1] ?? "param",
      in: "path",
      required: true,
      schema: { type: "string" },
    }))

    const explicitParams = parametersSchema.fields.map((f) => ({
      name: f.name,
      in: "path",
      required: f.required,
      schema: { type: f.type === "number" ? "number" : f.type === "boolean" ? "boolean" : "string" },
      ...(f.description ? { description: f.description } : {}),
    }))

    const queryParams = querySchema.fields.map((f) => ({
      name: f.name,
      in: "query",
      required: f.required,
      schema: fieldTypeToOpenApi(f.type),
      ...(f.description ? { description: f.description } : {}),
    }))

    const headerParams = headersSchema.fields.map((f) => ({
      name: f.name,
      in: "header",
      required: f.required,
      schema: { type: "string" },
      ...(f.description ? { description: f.description } : {}),
    }))

    const parameters = [...pathParams, ...explicitParams, ...queryParams, ...headerParams]
    const authNote = authSchema.fields.length > 0
      ? { "x-auth-fields": authSchema.fields.map((f) => f.name) }
      : {}

    const operation: Record<string, unknown> = {
      summary: contractLabel,
      ...(parameters.length > 0 ? { parameters } : {}),
      ...authNote,
      ...(hasBody ? {
        requestBody: {
          required: true,
          content: {
            [requestBodyFormat === "form-data" ? "multipart/form-data" : "application/json"]: {
              schema: schemaToOpenApi(requestSchema),
            },
          },
        },
      } : {}),
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

    const pathKey = path || "/"
    const existingPath = paths[pathKey] as Record<string, unknown> | undefined
    paths[pathKey] = { ...(existingPath ?? {}), [methodLower]: operation }
  }

  return {
    openapi: "3.0.3",
    info: { title, version: "1.0.0" },
    paths,
  }
}

export function toJson(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, null, 2)
}

export function toYaml(obj: Record<string, unknown>): string {
  return serializeYaml(obj, 0)
}

// ─── Minimal YAML serializer (no external dep) ────────────────────────────────

function serializeYaml(value: unknown, indent: number): string {
  const pad = "  ".repeat(indent)

  if (value === null || value === undefined) return "null"
  if (typeof value === "boolean") return value ? "true" : "false"
  if (typeof value === "number") return String(value)

  if (typeof value === "string") {
    // Quote if contains special chars or looks like a keyword
    if (
      value === "" ||
      /[:#\[\]{},|>&*!'"@`%]/.test(value) ||
      /^\s|\s$/.test(value) ||
      ["true", "false", "null", "yes", "no"].includes(value.toLowerCase())
    ) {
      return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
    }
    return value
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]"
    return value
      .map((item) => `${pad}- ${serializeYaml(item, indent + 1)}`)
      .join("\n")
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return "{}"
    return entries
      .map(([k, v]) => {
        const key = /[:#\[\]{},|>&*!'"@`%\s]/.test(k) ? `"${k}"` : k
        if (typeof v === "object" && v !== null && !Array.isArray(v) && Object.keys(v).length > 0) {
          return `${pad}${key}:\n${serializeYaml(v, indent + 1)}`
        }
        if (Array.isArray(v) && v.length > 0) {
          return `${pad}${key}:\n${serializeYaml(v, indent + 1)}`
        }
        return `${pad}${key}: ${serializeYaml(v, indent + 1)}`
      })
      .join("\n")
  }

  return String(value)
}
