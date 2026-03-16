import * as React from "react"
import { LayoutList, Code2 } from "lucide-react"
import { cn } from "@/lib/cn"
import type { ContractSchema, HttpMethod } from "@repo/types"
import { SwaggerOperationPreview } from "./swagger-preview"
import { OpenApiCodePreview } from "./openapi-code-preview"

type PreviewView = "visual" | "code"

interface JsonPreviewProps {
  querySchema: ContractSchema
  parametersSchema?: ContractSchema
  headersSchema?: ContractSchema
  authSchema?: ContractSchema
  requestBodyFormat: "json" | "form-data"
  requestSchema: ContractSchema
  responseSchema: ContractSchema
  method: HttpMethod
  path: string
}

const EMPTY_SCHEMA: ContractSchema = { fields: [] }

export function JsonPreview({
  querySchema,
  parametersSchema = EMPTY_SCHEMA,
  headersSchema = EMPTY_SCHEMA,
  authSchema = EMPTY_SCHEMA,
  requestBodyFormat,
  requestSchema,
  responseSchema,
  method,
  path,
}: JsonPreviewProps) {
  const [view, setView] = React.useState<PreviewView>("visual")

  return (
    <div className="space-y-3">
      {/* View toggle */}
      <div className="flex items-center gap-0 border-b border-border-subtle">
        {(
          [
            { key: "visual", label: "Visual", icon: LayoutList },
            { key: "code",   label: "Code",   icon: Code2 },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={cn(
              "relative flex items-center gap-1.5 px-4 py-2 font-mono text-xs font-medium transition-colors",
              view === key ? "text-text-primary" : "text-text-muted hover:text-text-secondary",
            )}
          >
            <Icon size={11} />
            {label}
            {view === key && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {view === "visual" ? (
        <SwaggerOperationPreview
          method={method}
          path={path}
          querySchema={querySchema}
          requestBodyFormat={requestBodyFormat}
          requestSchema={requestSchema}
          responseSchema={responseSchema}
          defaultOpen={true}
        />
      ) : (
        <OpenApiCodePreview
          method={method}
          path={path}
          querySchema={querySchema}
          parametersSchema={parametersSchema}
          headersSchema={headersSchema}
          authSchema={authSchema}
          requestBodyFormat={requestBodyFormat}
          requestSchema={requestSchema}
          responseSchema={responseSchema}
          exportFilename={`${method}-${path}`.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "openapi"}
        />
      )}
    </div>
  )
}
