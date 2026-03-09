import type { ContractSchema, HttpMethod } from "@repo/types"
import { SwaggerOperationPreview } from "./swagger-preview"

interface JsonPreviewProps {
  querySchema: ContractSchema
  requestBodyFormat: "json" | "form-data"
  requestSchema: ContractSchema
  responseSchema: ContractSchema
  method: HttpMethod
  path: string
}

export function JsonPreview({
  querySchema,
  requestBodyFormat,
  requestSchema,
  responseSchema,
  method,
  path,
}: JsonPreviewProps) {
  return (
    <SwaggerOperationPreview
      method={method}
      path={path}
      querySchema={querySchema}
      requestBodyFormat={requestBodyFormat}
      requestSchema={requestSchema}
      responseSchema={responseSchema}
    />
  )
}
