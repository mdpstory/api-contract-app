export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
export type ContractStatus = "draft" | "approved"
export type FieldType = "string" | "number" | "boolean" | "object" | "array" | "file"
export type RequestBodyFormat = "json" | "form-data"

export interface SchemaField {
  name: string
  type: FieldType
  required: boolean
  description?: string
}

export interface ContractSchema {
  fields: SchemaField[]
}

export interface Contract {
  id: string
  projectId: string
  groupId: string | null
  name: string
  method: HttpMethod
  path: string
  status: ContractStatus
  querySchema: ContractSchema
  parametersSchema: ContractSchema
  headersSchema: ContractSchema
  authSchema: ContractSchema
  requestBodyFormat: RequestBodyFormat
  requestSchema: ContractSchema
  responseSchema: ContractSchema
  createdAt: string
  updatedAt: string
}

export interface CreateContractInput {
  method: HttpMethod
  path: string
  groupId?: string | null
  querySchema?: ContractSchema
  parametersSchema?: ContractSchema
  headersSchema?: ContractSchema
  authSchema?: ContractSchema
  requestBodyFormat?: RequestBodyFormat
  requestSchema?: ContractSchema
  responseSchema?: ContractSchema
}

export interface UpdateContractInput {
  method?: HttpMethod
  path?: string
  groupId?: string | null
  status?: ContractStatus
  querySchema?: ContractSchema
  parametersSchema?: ContractSchema
  headersSchema?: ContractSchema
  authSchema?: ContractSchema
  requestBodyFormat?: RequestBodyFormat
  requestSchema?: ContractSchema
  responseSchema?: ContractSchema
}

export interface ContractGroup {
  id: string
  projectId: string
  name: string
  createdAt: string
  endpointCount: number
}

export interface CreateContractGroupInput {
  name: string
}

export interface UpdateContractGroupInput {
  name: string
}

export interface DeleteContractGroupInput {
  confirmName: string
}

export interface DeleteContractGroupResult {
  message: string
  deletedEndpointCount: number
}

// Versioning
export interface DiffEntry {
  field: string
  from: unknown
  to: unknown
}

export interface SchemaDiff {
  added: string[]
  removed: string[]
  changed: DiffEntry[]
}

export interface ContractDiff {
  name?: { from: string; to: string }
  method?: { from: HttpMethod; to: HttpMethod }
  path?: { from: string; to: string }
  groupId?: { from: string | null; to: string | null }
  status?: { from: ContractStatus; to: ContractStatus }
  requestBodyFormat?: { from: RequestBodyFormat; to: RequestBodyFormat }
  query?: SchemaDiff
  request?: SchemaDiff
  response?: SchemaDiff
}

export interface ContractVersion {
  id: string
  contractId: string
  version: number
  changedBy: string
  changedAt: string
  changeSummary: string
  snapshot: Contract
  diff: ContractDiff | null
  changedByUser?: {
    id: string
    name: string | null
    email: string
  }
}
