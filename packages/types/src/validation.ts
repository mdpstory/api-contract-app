export type ValidationResult = "passed" | "failed"

export interface ValidationFieldResult {
  field: string
  status: "valid" | "invalid" | "missing" | "extra"
  expected?: string
  received?: unknown
  message?: string
}

export interface ValidationRunInput {
  url: string
  environmentId?: string
  headers?: Record<string, string>
  body?: unknown
}

export interface ValidationRun {
  id: string
  contractId: string
  environmentId: string | null
  url: string
  requestHeaders: Record<string, string>
  requestBody: unknown
  result: ValidationResult
  details: ValidationFieldResult[]
  createdAt: string
}
