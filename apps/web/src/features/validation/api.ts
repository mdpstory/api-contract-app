import { apiFetch } from "@/lib/fetch"
import type { ValidationRun, ValidationRunInput } from "@repo/types"

const BASE = "/api"

export async function runValidation(
  projectId: string,
  contractId: string,
  input: ValidationRunInput
): Promise<ValidationRun & { responseData: unknown }> {
  return apiFetch<ValidationRun & { responseData: unknown }>(
    `${BASE}/projects/${projectId}/contracts/${contractId}/validate`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  )
}

export async function getValidationHistory(
  projectId: string,
  contractId: string
): Promise<ValidationRun[]> {
  return apiFetch<ValidationRun[]>(
    `${BASE}/projects/${projectId}/contracts/${contractId}/validations`
  )
}

export async function exportOpenApi(
  projectId: string,
  contractId: string
): Promise<void> {
  const res = await fetch(
    `${BASE}/projects/${projectId}/contracts/${contractId}/export/openapi`,
    { credentials: "include" }
  )
  if (!res.ok) throw new Error("Export failed")

  const disposition = res.headers.get("Content-Disposition")
  const filenameMatch = disposition?.match(/filename="([^"]+)"/i)
  const filename = filenameMatch?.[1] ?? "contract-openapi.json"

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
