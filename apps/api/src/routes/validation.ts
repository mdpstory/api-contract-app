import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import { db } from "../db"
import {
  contracts,
  envVariables,
  environments,
  projectMembers,
  validationRuns,
} from "../db/schema"
import { and, eq } from "drizzle-orm"
import { generateId } from "../lib/id"
import { requireAuth } from "../middleware/auth"
import { interpolate, interpolateObject } from "../lib/interpolate"
import type { UserRow } from "../db/schema"
import type {
  ContractSchema,
  ValidationFieldResult,
} from "@repo/types"

type AuthEnv = { Variables: { user: UserRow } }

const runValidationSchema = z.object({
  url: z.string().min(1),
  environmentId: z.string().optional(),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
})

async function assertMembership(
  projectId: string,
  userId: string
): Promise<boolean> {
  const membership = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId)
      )
    )
    .get()

  return !!membership
}

async function getProjectContract(projectId: string, contractId: string) {
  return db
    .select()
    .from(contracts)
    .where(and(eq(contracts.id, contractId), eq(contracts.projectId, projectId)))
    .get()
}

function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase()

  if (!normalized) return true
  if (normalized === "localhost") return true
  if (normalized.endsWith(".local") || normalized.endsWith(".internal")) {
    return true
  }

  if (normalized === "::1") return true
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true
  if (normalized.startsWith("fe80:")) return true

  const ipv4Match = normalized.match(/^(\d{1,3})(?:\.(\d{1,3})){3}$/)
  if (!ipv4Match) return false

  const octets = normalized.split(".").map(Number)
  if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
    return true
  }

  const first = octets[0] ?? -1
  const second = octets[1] ?? -1
  if (first === 10 || first === 127) return true
  if (first === 169 && second === 254) return true
  if (first === 192 && second === 168) return true
  if (first === 172 && second >= 16 && second <= 31) return true

  return false
}

function isPrivateIpAddress(address: string): boolean {
  const normalized = address.trim().toLowerCase()
  const ipVersion = isIP(normalized)

  if (ipVersion === 0) {
    return isPrivateHostname(normalized)
  }

  if (ipVersion === 4) {
    return isPrivateHostname(normalized)
  }

  if (normalized === "::1") return true
  if (normalized === "::") return true
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true
  if (normalized.startsWith("fe80:")) return true
  if (normalized.startsWith("::ffff:")) {
    return isPrivateIpAddress(normalized.slice(7))
  }

  return false
}

async function validateOutboundUrl(rawUrl: string): Promise<{ ok: true; url: string } | {
  ok: false
  error: string
}> {
  let parsed: URL

  try {
    parsed = new URL(rawUrl)
  } catch {
    return { ok: false, error: "Validation URL must be a valid absolute URL" }
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Validation URL must use http or https" }
  }

  if (isPrivateHostname(parsed.hostname)) {
    return {
      ok: false,
      error: "Validation URL cannot target localhost or private network hosts",
    }
  }

  try {
    const addresses = await lookup(parsed.hostname, { all: true, verbatim: true })

    if (addresses.length === 0) {
      return { ok: false, error: "Validation URL hostname could not be resolved" }
    }

    if (addresses.some((entry) => isPrivateIpAddress(entry.address))) {
      return {
        ok: false,
        error: "Validation URL cannot resolve to localhost or private network hosts",
      }
    }
  } catch {
    return { ok: false, error: "Validation URL hostname could not be resolved" }
  }

  return { ok: true, url: parsed.toString() }
}

// ─── Validation logic ─────────────────────────────────────────────────────────

function splitFieldPath(path: string): string[] {
  return path
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean)
}

function getValueAtPath(
  data: Record<string, unknown>,
  path: string
): { exists: boolean; value: unknown } {
  const segments = splitFieldPath(path)
  if (segments.length === 0) {
    return { exists: false, value: undefined }
  }

  let current: unknown = data

  for (const segment of segments) {
    if (typeof current !== "object" || current === null || Array.isArray(current)) {
      return { exists: false, value: undefined }
    }

    const record = current as Record<string, unknown>
    if (!Object.prototype.hasOwnProperty.call(record, segment)) {
      return { exists: false, value: undefined }
    }

    current = record[segment]
  }

  return { exists: true, value: current }
}

function validateResponse(
  responseData: unknown,
  schema: ContractSchema
): ValidationFieldResult[] {
  const results: ValidationFieldResult[] = []

  if (typeof responseData !== "object" || responseData === null) {
    return [
      {
        field: "root",
        status: "invalid",
        expected: "object",
        received: typeof responseData,
        message: "Response is not an object",
      },
    ]
  }

  const data = responseData as Record<string, unknown>

  for (const field of schema.fields) {
    const { exists, value } = getValueAtPath(data, field.name)

    if (!exists || value === null) {
      if (field.required) {
        results.push({
          field: field.name,
          status: "missing",
          expected: field.type,
          received: undefined,
          message: `Required field '${field.name}' is missing`,
        })
      }
      continue
    }

    const actualType = Array.isArray(value) ? "array" : typeof value
    const expectedType = field.type

    if (actualType !== expectedType) {
      results.push({
        field: field.name,
        status: "invalid",
        expected: expectedType,
        received: actualType,
        message: `Field '${field.name}' expected ${expectedType}, got ${actualType}`,
      })
    } else {
      results.push({
        field: field.name,
        status: "valid",
        expected: expectedType,
        received: value,
      })
    }
  }

  return results
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export const validationRoutes = new Hono<AuthEnv>()

  .use(requireAuth)

  // POST /projects/:projectId/contracts/:contractId/validate
  .post(
    "/projects/:projectId/contracts/:contractId/validate",
    zValidator("json", runValidationSchema),
    async (c) => {
      const user = c.var.user
      const { projectId, contractId } = c.req.param()
      const body = c.req.valid("json")

      // Assert membership
      if (!(await assertMembership(projectId, user.id))) {
        return c.json({ error: "Project not found" }, 404)
      }

      const contract = await getProjectContract(projectId, contractId)

      if (!contract) return c.json({ error: "Contract not found" }, 404)

      // Build variables map from selected environment
      const variables: Record<string, string> = {}

      if (body.environmentId) {
        const env = await db
          .select()
          .from(environments)
          .where(
            and(
              eq(environments.id, body.environmentId),
              eq(environments.projectId, projectId)
            )
          )
          .get()

        if (!env) {
          return c.json({ error: "Environment not found" }, 404)
        }

        const vars = await db
          .select()
          .from(envVariables)
          .where(eq(envVariables.environmentId, env.id))

        for (const v of vars) {
          variables[v.key] = v.value
        }
      }

      // Also merge Global environment variables
      const globalEnv = await db
        .select()
        .from(environments)
        .where(
          and(
            eq(environments.projectId, projectId),
            eq(environments.isGlobal, true)
          )
        )
        .get()

      if (globalEnv) {
        const globalVars = await db
          .select()
          .from(envVariables)
          .where(eq(envVariables.environmentId, globalEnv.id))

        for (const v of globalVars) {
          // Don't override env-specific variables
          if (!(v.key in variables)) {
            variables[v.key] = v.value
          }
        }
      }

      // Interpolate URL and headers
      const resolvedUrl = interpolate(body.url, variables)
      const safeUrl = await validateOutboundUrl(resolvedUrl)

      if (!safeUrl.ok) {
        return c.json({ error: safeUrl.error }, 400)
      }

      const resolvedHeaders = body.headers
        ? (interpolateObject(body.headers, variables) as Record<string, string>)
        : {}
      const resolvedBody = body.body
        ? interpolateObject(body.body, variables)
        : undefined
      const requestBodyFormat = contract.requestBodyFormat as "json" | "form-data"

      // Make the actual HTTP request
      let responseData: unknown
      let fetchError: string | null = null

      try {
        const fetchOptions: RequestInit = {
          method: contract.method,
          headers: {
            ...resolvedHeaders,
          },
        }

        if (resolvedBody && contract.method !== "GET") {
          if (requestBodyFormat === "form-data") {
            const formData = new FormData()
            if (typeof resolvedBody === "object" && resolvedBody !== null && !Array.isArray(resolvedBody)) {
              for (const [key, value] of Object.entries(resolvedBody as Record<string, unknown>)) {
                formData.append(key, String(value ?? ""))
              }
            }
            fetchOptions.body = formData
          } else {
            fetchOptions.headers = {
              "Content-Type": "application/json",
              ...resolvedHeaders,
            }
            fetchOptions.body = JSON.stringify(resolvedBody)
          }
        }

        const response = await fetch(safeUrl.url, fetchOptions)
        responseData = await response.json()
      } catch (err) {
        fetchError = err instanceof Error ? err.message : "Unknown fetch error"
      }

      if (fetchError) {
        return c.json(
          {
            result: "failed",
            error: fetchError,
            details: [],
          },
          200
        )
      }

      // Validate response against schema
      const responseSchema = JSON.parse(
        contract.responseSchema
      ) as ContractSchema
      const details = validateResponse(responseData, responseSchema)

      const result = details.every(
        (d) => d.status === "valid" || d.status === "extra"
      )
        ? "passed"
        : "failed"

      // Save validation run
      const runId = generateId()
      await db.insert(validationRuns).values({
        id: runId,
        contractId,
        environmentId: body.environmentId ?? null,
        url: safeUrl.url,
        requestHeaders: JSON.stringify(resolvedHeaders),
        requestBody: resolvedBody ? JSON.stringify(resolvedBody) : null,
        result,
        details: JSON.stringify(details),
      })

      return c.json({ id: runId, result, details, responseData })
    }
  )

  // GET /projects/:projectId/contracts/:contractId/validations
  .get(
    "/projects/:projectId/contracts/:contractId/validations",
    async (c) => {
      const user = c.var.user
      const { projectId, contractId } = c.req.param()

      if (!(await assertMembership(projectId, user.id))) {
        return c.json({ error: "Project not found" }, 404)
      }

      const contract = await getProjectContract(projectId, contractId)

      if (!contract) {
        return c.json({ error: "Contract not found" }, 404)
      }

      const runs = await db
        .select()
        .from(validationRuns)
        .where(eq(validationRuns.contractId, contractId))

      return c.json(
        runs.map((r) => ({
          ...r,
          requestHeaders: JSON.parse(r.requestHeaders),
          requestBody: r.requestBody ? JSON.parse(r.requestBody) : null,
          details: JSON.parse(r.details),
        }))
      )
    }
  )
