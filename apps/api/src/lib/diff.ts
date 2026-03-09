import type { ContractDiff, ContractSchema, SchemaDiff } from "@repo/types"
import type { Contract } from "@repo/types"

/**
 * Generate a field-by-field diff between two contract schemas.
 */
function diffSchema(
  before: ContractSchema,
  after: ContractSchema
): SchemaDiff | null {
  const beforeFields = new Map(before.fields.map((f) => [f.name, f]))
  const afterFields = new Map(after.fields.map((f) => [f.name, f]))

  const added: string[] = []
  const removed: string[] = []
  const changed: SchemaDiff["changed"] = []

  for (const [name, afterField] of afterFields) {
    const beforeField = beforeFields.get(name)
    if (!beforeField) {
      added.push(name)
    } else if (
      beforeField.type !== afterField.type ||
      beforeField.required !== afterField.required ||
      beforeField.description !== afterField.description
    ) {
      changed.push({ field: name, from: beforeField, to: afterField })
    }
  }

  for (const name of beforeFields.keys()) {
    if (!afterFields.has(name)) {
      removed.push(name)
    }
  }

  if (added.length === 0 && removed.length === 0 && changed.length === 0) {
    return null
  }

  return { added, removed, changed }
}

/**
 * Compute a full diff between two contract snapshots.
 * Returns null if nothing changed.
 */
export function computeContractDiff(
  before: Contract,
  after: Contract
): ContractDiff | null {
  const diff: ContractDiff = {}

  if (before.name !== after.name) {
    diff.name = { from: before.name, to: after.name }
  }
  if (before.method !== after.method) {
    diff.method = { from: before.method, to: after.method }
  }
  if (before.path !== after.path) {
    diff.path = { from: before.path, to: after.path }
  }
  if (before.groupId !== after.groupId) {
    diff.groupId = { from: before.groupId, to: after.groupId }
  }
  if (before.status !== after.status) {
    diff.status = { from: before.status, to: after.status }
  }

  const requestDiff = diffSchema(before.requestSchema, after.requestSchema)
  if (requestDiff) diff.request = requestDiff

  const queryDiff = diffSchema(before.querySchema, after.querySchema)
  if (queryDiff) diff.query = queryDiff

  const responseDiff = diffSchema(before.responseSchema, after.responseSchema)
  if (responseDiff) diff.response = responseDiff

  if (Object.keys(diff).length === 0) return null

  return diff
}

/**
 * Generate a human-readable summary from a diff.
 */
export function generateChangeSummary(
  diff: ContractDiff | null,
  isFirst: boolean
): string {
  if (isFirst) return "Initial version"
  if (!diff) return "No changes"

  const parts: string[] = []

  if (diff.name) {
    parts.push(`Changed name: ${diff.name.from} → ${diff.name.to}`)
  }
  if (diff.method) {
    parts.push(`Changed method: ${diff.method.from} → ${diff.method.to}`)
  }
  if (diff.path) {
    parts.push(`Changed path: ${diff.path.from} → ${diff.path.to}`)
  }
  if (diff.groupId) {
    parts.push(
      `Changed group: ${diff.groupId.from ?? "Ungrouped"} → ${diff.groupId.to ?? "Ungrouped"}`
    )
  }
  if (diff.status) {
    parts.push(`Changed status: ${diff.status.from} → ${diff.status.to}`)
  }
  if (diff.request) {
    if (diff.request.added.length > 0) {
      parts.push(`Added request field(s): ${diff.request.added.join(", ")}`)
    }
    if (diff.request.removed.length > 0) {
      parts.push(`Removed request field(s): ${diff.request.removed.join(", ")}`)
    }
    if (diff.request.changed.length > 0) {
      parts.push(
        `Changed request field(s): ${diff.request.changed.map((c) => c.field).join(", ")}`
      )
    }
  }
  if (diff.query) {
    if (diff.query.added.length > 0) {
      parts.push(`Added query field(s): ${diff.query.added.join(", ")}`)
    }
    if (diff.query.removed.length > 0) {
      parts.push(`Removed query field(s): ${diff.query.removed.join(", ")}`)
    }
    if (diff.query.changed.length > 0) {
      parts.push(
        `Changed query field(s): ${diff.query.changed.map((c) => c.field).join(", ")}`
      )
    }
  }
  if (diff.response) {
    if (diff.response.added.length > 0) {
      parts.push(`Added response field(s): ${diff.response.added.join(", ")}`)
    }
    if (diff.response.removed.length > 0) {
      parts.push(
        `Removed response field(s): ${diff.response.removed.join(", ")}`
      )
    }
    if (diff.response.changed.length > 0) {
      parts.push(
        `Changed response field(s): ${diff.response.changed.map((c) => c.field).join(", ")}`
      )
    }
  }

  return parts.join("; ") || "Minor changes"
}
