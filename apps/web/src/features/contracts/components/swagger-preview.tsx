import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  SchemaLivePreview,
  type PreviewMode,
} from "@/features/contracts/components/schema-live-preview"
import { schemaToExample } from "@/features/contracts/lib/schema-preview"
import { cn } from "@/lib/cn"
import { useToast } from "@/lib/toast"
import type {
  Contract,
  ContractGroup,
  ContractSchema,
  HttpMethod,
} from "@repo/types"

interface SwaggerOperationPreviewProps {
  method: HttpMethod
  path: string
  querySchema: ContractSchema
  requestBodyFormat: "json" | "form-data"
  requestSchema: ContractSchema
  responseSchema: ContractSchema
  status?: Contract["status"]
}

interface SwaggerProjectPreviewProps {
  contracts: Contract[]
  groups: ContractGroup[]
}

interface PathParameter {
  name: string
  source: "colon" | "brace"
}

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "method-get",
  POST: "method-post",
  PUT: "method-put",
  PATCH: "method-patch",
  DELETE: "method-delete",
}

function parsePathParameters(path: string): PathParameter[] {
  const seen = new Set<string>()
  const parameters: PathParameter[] = []

  for (const match of path.matchAll(/:([A-Za-z0-9_]+)/g)) {
    const name = match[1]
    if (!name || seen.has(name)) continue
    seen.add(name)
    parameters.push({ name, source: "colon" })
  }

  for (const match of path.matchAll(/\{([^}]+)\}/g)) {
    const name = match[1]?.trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    parameters.push({ name, source: "brace" })
  }

  return parameters
}

function pathForDisplay(path: string): string {
  return path.trim() || "/your/path"
}

function pathForCurl(path: string): string {
  return pathForDisplay(path).replace(/:([A-Za-z0-9_]+)/g, (_, name: string) => `{${name}}`)
}

function buildCurlSnippet({
  method,
  path,
  querySchema,
  requestBodyFormat,
  requestSchema,
}: {
  method: HttpMethod
  path: string
  querySchema: ContractSchema
  requestBodyFormat: "json" | "form-data"
  requestSchema: ContractSchema
}): string {
  const hasBody = ["POST", "PUT", "PATCH"].includes(method)
  const requestExample = schemaToExample(requestSchema)
  const queryEntries = querySchema.fields
    .filter((field) => field.type !== "object" && field.type !== "file")
    .map((field) => {
      const sampleValue = schemaToExample({ fields: [field] })[field.name]
      return [field.name, String(sampleValue)] as const
    })
  const queryString = queryEntries.length > 0
    ? `?${new URLSearchParams(queryEntries).toString()}`
    : ""
  const lines = [
    `curl -X ${method} \\
  "https://api.example.com${pathForCurl(path)}${queryString}" \\
  -H "Content-Type: ${requestBodyFormat === "form-data" ? "multipart/form-data" : "application/json"}"`,
  ]

  if (hasBody && requestSchema.fields.length > 0) {
    if (requestBodyFormat === "form-data") {
      for (const field of requestSchema.fields) {
        if (field.type === "object") continue
        if (field.type === "file") {
          lines.push(`  -F "${field.name}=@/path/to/file"`)
          continue
        }
        const sampleValue = schemaToExample({ fields: [field] })[field.name]
        lines.push(`  -F "${field.name}=${String(sampleValue)}"`)
      }
    } else {
      const body = JSON.stringify(requestExample, null, 2).split("\n").join("\\n")
      lines.push(`  -d '${body}'`)
    }
  }

  return lines.join(" \\\n+")
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full border border-border-subtle bg-elevated px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-text-secondary">
        {children}
      </span>
    </div>
  )
}

function EmptyBox({ message }: { message: string }) {
  return (
    <div className="min-h-[146px] rounded-b-md border border-dashed border-border-subtle bg-base px-4 py-5 font-mono text-xs tracking-wide text-text-muted">
      {message}
    </div>
  )
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const { toast } = useToast()
  const timeoutRef = React.useRef<number | null>(null)
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast({ title: `${label} copied`, variant: "success" })

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = window.setTimeout(() => {
        setCopied(false)
        timeoutRef.current = null
      }, 1200)
    } catch {
      toast({ title: `Could not copy ${label.toLowerCase()}`, variant: "error" })
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      onClick={handleCopy}
      className="h-6 px-2 text-[10px]"
    >
      {copied ? "Copied" : "Copy"}
    </Button>
  )
}

function Panel({
  label,
  children,
  stretch = false,
  action,
}: {
  label: string
  children: React.ReactNode
  stretch?: boolean
  action?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-md border border-border-subtle bg-surface shadow-brutal-sm",
        stretch && "h-full"
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle bg-elevated px-3 py-2.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-secondary">
          {label}
        </span>
        {action}
      </div>
      <div className={cn("min-w-0", stretch && "h-full")}>{children}</div>
    </div>
  )
}

function SchemaTable({ schema }: { schema: ContractSchema }) {
  if (schema.fields.length === 0) {
    return <EmptyBox message="No schema defined" />
  }

  return (
    <div className="overflow-hidden bg-surface">
      <div className="grid grid-cols-[minmax(0,1.6fr)_90px_90px] gap-2 border-b border-border-subtle px-3 py-2 font-mono">
        <span className="text-[10px] uppercase tracking-[0.15em] text-text-muted">Field</span>
        <span className="text-[10px] uppercase tracking-[0.15em] text-text-muted">Type</span>
        <span className="text-[10px] uppercase tracking-[0.15em] text-center text-text-muted">Required</span>
      </div>

      {schema.fields.map((field, index) => (
        <div
          key={`${field.name}-${index}`}
          className={cn(
            "grid grid-cols-[minmax(0,1.6fr)_90px_90px] gap-2 px-3 py-2 text-xs",
            index < schema.fields.length - 1 && "border-b border-border-subtle/60"
          )}
        >
          <span className="break-all font-mono text-text-primary">{field.name}</span>
          <span className="font-mono text-text-secondary">{field.type}</span>
          <span className="flex justify-center">
            <span
              className={cn(
                "rounded-md border px-2 py-1 font-mono text-[9px] font-medium uppercase tracking-[0.12em] leading-none",
                field.required
                  ? "border-success/25 bg-success/12 text-success"
                  : "border-warning/20 bg-warning/10 text-warning"
              )}
            >
              {field.required ? "yes" : "no"}
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}

function ParametersTable({ path }: { path: string }) {
  const parameters = parsePathParameters(path)

  if (parameters.length === 0) {
    return <EmptyBox message="No path parameters" />
  }

  return (
    <div className="overflow-hidden bg-surface">
      <div className="grid grid-cols-[minmax(0,1fr)_110px_110px] gap-2 border-b border-border-subtle px-3 py-2 font-mono">
        <span className="text-[10px] uppercase tracking-[0.15em] text-text-muted">Name</span>
        <span className="text-[10px] uppercase tracking-[0.15em] text-text-muted">In</span>
        <span className="text-[10px] uppercase tracking-[0.15em] text-right text-text-muted">Type</span>
      </div>

      {parameters.map((parameter, index) => (
        <div
          key={`${parameter.name}-${parameter.source}`}
          className={cn(
            "grid grid-cols-[minmax(0,1fr)_110px_110px] gap-2 px-3 py-2 text-xs",
            index < parameters.length - 1 && "border-b border-border-subtle/60"
          )}
        >
          <span className="font-mono text-text-primary">{parameter.name}</span>
          <span className="text-text-secondary">path</span>
          <span className="text-right font-mono text-text-secondary">string</span>
        </div>
      ))}
    </div>
  )
}

function QuerySection({ querySchema }: { querySchema: ContractSchema }) {
  const [previewMode, setPreviewMode] = React.useState<PreviewMode>("typescript")

  if (querySchema.fields.length === 0) {
    return null
  }

  return (
    <section className="space-y-3">
      <SectionLabel>Query</SectionLabel>
      <div className="grid gap-4 xl:auto-rows-fr xl:grid-cols-2">
        <Panel label="Query Fields" stretch>
          <SchemaTable schema={querySchema} />
        </Panel>
        <SchemaLivePreview
          label="Preview"
          schema={querySchema}
          emptyMessage="No query preview available"
          mode={previewMode}
          onModeChange={setPreviewMode}
        />
      </div>
    </section>
  )
}

function ResponseSection({ responseSchema }: { responseSchema: ContractSchema }) {
  const [previewMode, setPreviewMode] = React.useState<PreviewMode>("typescript")

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <SectionLabel>Responses</SectionLabel>
        <Badge variant="approved">200 OK</Badge>
      </div>

      <div className="grid gap-4 xl:auto-rows-fr xl:grid-cols-2">
        <Panel label="Response Schema" stretch>
          <SchemaTable schema={responseSchema} />
        </Panel>
        <SchemaLivePreview
          label="Preview"
          schema={responseSchema}
          emptyMessage="No response preview available"
          mode={previewMode}
          onModeChange={setPreviewMode}
        />
      </div>
    </section>
  )
}

function RequestSection({
  method,
  querySchema,
  requestBodyFormat,
  requestSchema,
}: {
  method: HttpMethod
  querySchema: ContractSchema
  requestBodyFormat: "json" | "form-data"
  requestSchema: ContractSchema
}) {
  const hasBody = ["POST", "PUT", "PATCH"].includes(method)
  const [previewMode, setPreviewMode] = React.useState<PreviewMode>("typescript")

  if (requestSchema.fields.length === 0 && querySchema.fields.length === 0) {
    return <EmptyBox message={hasBody ? "No request schema defined" : `No request shape defined for ${method}`} />
  }

  return (
    <section className="space-y-3">
      <SectionLabel>{hasBody ? "Request Body" : "Request Shape"}</SectionLabel>
      <div className="grid gap-4 xl:auto-rows-fr xl:grid-cols-2">
        <Panel label={hasBody ? (requestBodyFormat === "form-data" ? "Form Data Fields" : "Request Schema") : "Request Fields"} stretch>
          <SchemaTable schema={requestSchema} />
        </Panel>
        <SchemaLivePreview
          label="Preview"
          schema={requestSchema}
          emptyMessage={hasBody ? "No request preview available" : `No request shape preview available for ${method}`}
          mode={previewMode}
          onModeChange={setPreviewMode}
        />
      </div>
    </section>
  )
}

export function SwaggerOperationPreview({
  method,
  path,
  querySchema,
  requestBodyFormat,
  requestSchema,
  responseSchema,
  status,
}: SwaggerOperationPreviewProps) {
  const curlSnippet = buildCurlSnippet({ method, path, querySchema, requestBodyFormat, requestSchema })

  return (
    <article className="overflow-hidden rounded-md border border-border-subtle bg-surface shadow-brutal-sm">
      <div className="border-b border-border-subtle bg-elevated px-4 py-3">
        <div className="flex flex-wrap items-stretch gap-2">
              <span
                className={cn(
                  "flex h-10 min-w-20 items-center justify-center rounded-sm px-3 text-center font-mono text-[11px] font-semibold uppercase tracking-[0.16em]",
                  METHOD_COLORS[method]
                )}
              >
                {method}
              </span>
            <code className="flex min-h-10 min-w-[220px] flex-1 items-center rounded-sm border border-border-subtle bg-base px-3 font-mono text-sm break-all text-text-primary">
              {pathForDisplay(path)}
            </code>
          {status && (
            <span className="flex h-10 items-center">
              <Badge variant={status === "approved" ? "approved" : "draft"}>{status}</Badge>
            </span>
          )}
        </div>
      </div>

      <div className="space-y-6 p-4 md:p-5">
        <section className="space-y-3">
          <SectionLabel>Parameters</SectionLabel>
          <Panel label="Path Parameters">
            <ParametersTable path={path} />
          </Panel>
        </section>

        <QuerySection querySchema={querySchema} />

        <RequestSection method={method} querySchema={querySchema} requestBodyFormat={requestBodyFormat} requestSchema={requestSchema} />

        <ResponseSection responseSchema={responseSchema} />

        <section className="space-y-3">
          <SectionLabel>Code Sample</SectionLabel>
          <Panel label="cURL" action={<CopyButton value={curlSnippet} label="cURL" />}>
            <pre className="max-w-full overflow-x-auto rounded-b-md bg-ink p-4 font-mono text-xs leading-relaxed text-text-primary">
              {curlSnippet}
            </pre>
          </Panel>
        </section>
      </div>
    </article>
  )
}

export function SwaggerProjectPreview({ contracts, groups }: SwaggerProjectPreviewProps) {
  const groupById = new Map(groups.map((group) => [group.id, group]))
  const groupedContracts = groups.map((group) => ({
    group,
    contracts: contracts.filter((contract) => contract.groupId === group.id),
  }))
  const ungroupedContracts = contracts.filter(
    (contract) => !contract.groupId || !groupById.has(contract.groupId)
  )

  if (contracts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-default bg-surface/40 px-6 py-12 text-center shadow-brutal-sm">
        <p className="text-lg font-semibold tracking-tight text-text-primary">
          No endpoints yet
        </p>
        <p className="mt-2 text-sm text-text-secondary">
          Add an endpoint to generate project-wide API docs.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border-subtle bg-surface px-5 py-5 shadow-brutal">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-text-muted">
              Preview All
            </p>
            <h2 className="text-xl font-semibold tracking-tight text-text-primary">
              Project API Docs
            </h2>
          </div>
          <div className="rounded-md border border-border-subtle bg-elevated px-4 py-2 text-right shadow-brutal-sm">
            <p className="text-[10px] uppercase tracking-[0.15em] text-text-muted">
              Endpoints
            </p>
            <p className="font-mono text-xl font-semibold text-text-primary">{contracts.length}</p>
          </div>
        </div>
      </div>

      {groupedContracts.map(({ group, contracts: groupContracts }) => {
        if (groupContracts.length === 0) return null

        return (
          <section key={group.id} className="space-y-4">
            <div className="flex items-center gap-3 border-b border-border-subtle pb-2">
              <span className="rounded-full border border-border-subtle bg-elevated px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-text-secondary">
                Group
              </span>
              <h3 className="text-sm font-semibold tracking-tight text-text-primary">
                {group.name}
              </h3>
              <span className="font-mono text-[11px] font-medium text-text-muted">
                {groupContracts.length}
              </span>
            </div>

            <div className="space-y-4">
              {groupContracts.map((contract) => (
                <SwaggerOperationPreview
                  key={contract.id}
                  method={contract.method}
                  path={contract.path}
                  querySchema={contract.querySchema}
                  requestBodyFormat={contract.requestBodyFormat}
                  requestSchema={contract.requestSchema}
                  responseSchema={contract.responseSchema}
                  status={contract.status}
                />
              ))}
            </div>
          </section>
        )
      })}

      {ungroupedContracts.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-3 border-b border-border-subtle pb-2">
            <span className="rounded-full border border-border-subtle bg-elevated px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-text-secondary">
              Group
            </span>
            <h3 className="text-sm font-semibold tracking-tight text-text-primary">
              Ungrouped
            </h3>
            <span className="font-mono text-[11px] font-medium text-text-muted">
              {ungroupedContracts.length}
            </span>
          </div>

          <div className="space-y-4">
            {ungroupedContracts.map((contract) => (
              <SwaggerOperationPreview
                key={contract.id}
                method={contract.method}
                path={contract.path}
                querySchema={contract.querySchema}
                requestBodyFormat={contract.requestBodyFormat}
                requestSchema={contract.requestSchema}
                responseSchema={contract.responseSchema}
                status={contract.status}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
