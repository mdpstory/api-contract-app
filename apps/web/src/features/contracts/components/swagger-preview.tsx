import * as React from "react"
import { LayoutList, Code2, ChevronDown, ChevronsUpDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  SchemaLivePreview,
  type PreviewMode,
} from "@/features/contracts/components/schema-live-preview"
import { schemaToExample } from "@/features/contracts/lib/schema-preview"
import { generateProjectOpenApiObject, toJson, toYaml } from "@/features/contracts/lib/openapi-gen"
import { OpenApiCodePreview } from "@/features/contracts/components/openapi-code-preview"
import { cn } from "@/lib/cn"
import { useToast } from "@/lib/toast"
import type {
  Contract,
  ContractGroup,
  ContractSchema,
  HttpMethod,
} from "@repo/types"

type ProjectPreviewView = "visual" | "code"

interface SwaggerOperationPreviewProps {
  method: HttpMethod
  path: string
  querySchema: ContractSchema
  requestBodyFormat: "json" | "form-data"
  requestSchema: ContractSchema
  responseSchema: ContractSchema
  status?: Contract["status"]
  /** When true the card starts expanded; defaults to false (collapsed) */
  defaultOpen?: boolean
  /** Synced signal from parent expand/collapse all; null means no pending command */
  allOpen?: boolean | null
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
      return [field.name, String(sampleValue)]
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

// ─── Chevron indicator ────────────────────────────────────────────────────────

function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronDown
      size={12}
      className={cn(
        "shrink-0 text-text-muted transition-transform duration-200",
        open ? "rotate-0" : "-rotate-90",
      )}
    />
  )
}

// ─── Collapsible section wrapper ──────────────────────────────────────────────
// Used for the inner sections: Parameters, Query, Request, Response, Code Sample

function CollapsibleSection({
  label,
  badge,
  children,
  defaultOpen = true,
}: {
  label: React.ReactNode
  badge?: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left"
      >
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <span className="rounded-full border border-border-subtle bg-elevated px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-text-secondary">
            {label}
          </span>
          {badge}
        </div>
        <Chevron open={open} />
      </button>
      {open && children}
    </section>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

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
    <CollapsibleSection label="Query">
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
    </CollapsibleSection>
  )
}

function ResponseSection({ responseSchema }: { responseSchema: ContractSchema }) {
  const [previewMode, setPreviewMode] = React.useState<PreviewMode>("typescript")

  return (
    <CollapsibleSection label="Responses" badge={<Badge variant="approved">200 OK</Badge>}>
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
    </CollapsibleSection>
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
    <CollapsibleSection label={hasBody ? "Request Body" : "Request Shape"}>
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
    </CollapsibleSection>
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
  defaultOpen = false,
  allOpen = null,
}: SwaggerOperationPreviewProps) {
  const [open, setOpen] = React.useState(defaultOpen)
  const prevAllOpen = React.useRef<boolean | null>(null)
  const curlSnippet = buildCurlSnippet({ method, path, querySchema, requestBodyFormat, requestSchema })

  React.useEffect(() => {
    if (allOpen !== null && allOpen !== prevAllOpen.current) {
      setOpen(allOpen)
      prevAllOpen.current = allOpen
    }
  }, [allOpen])

  return (
    <article className="overflow-hidden rounded-md border border-border-subtle bg-surface shadow-brutal-sm">
      {/* ── Header — always visible, click to toggle ── */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 border-b border-border-subtle bg-elevated px-4 py-3 text-left transition-colors hover:bg-overlay"
      >
        <div className="flex flex-1 flex-wrap items-stretch gap-2">
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
        <Chevron open={open} />
      </button>

      {/* ── Body — collapsible ── */}
      {open && (
        <div className="space-y-6 p-4 md:p-5">
          <CollapsibleSection label="Parameters">
            <Panel label="Path Parameters">
              <ParametersTable path={path} />
            </Panel>
          </CollapsibleSection>

          <QuerySection querySchema={querySchema} />

          <RequestSection
            method={method}
            querySchema={querySchema}
            requestBodyFormat={requestBodyFormat}
            requestSchema={requestSchema}
          />

          <ResponseSection responseSchema={responseSchema} />

          <CollapsibleSection label="Code Sample">
            <Panel label="cURL" action={<CopyButton value={curlSnippet} label="cURL" />}>
              <pre className="max-w-full overflow-x-auto rounded-b-md bg-ink p-4 font-mono text-xs leading-relaxed text-text-primary">
                {curlSnippet}
              </pre>
            </Panel>
          </CollapsibleSection>
        </div>
      )}
    </article>
  )
}

const EMPTY_SCHEMA: ContractSchema = { fields: [] }

// ─── Collapsible group section ─────────────────────────────────────────────────

function GroupSection({
  label,
  count,
  allOpen,
  children,
}: {
  label: string
  count: number
  allOpen: boolean | null
  children: React.ReactNode
}) {
  // Sync with the global expand/collapse all signal
  const [open, setOpen] = React.useState(true)
  const prevAllOpen = React.useRef<boolean | null>(null)

  React.useEffect(() => {
    if (allOpen !== null && allOpen !== prevAllOpen.current) {
      setOpen(allOpen)
      prevAllOpen.current = allOpen
    }
  }, [allOpen])

  return (
    <section className="space-y-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 border-b border-border-subtle pb-2 text-left"
      >
        <span className="rounded-full border border-border-subtle bg-elevated px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-text-secondary">
          Group
        </span>
        <h3 className="flex-1 text-sm font-semibold tracking-tight text-text-primary">
          {label}
        </h3>
        <span className="font-mono text-[11px] font-medium text-text-muted">
          {count}
        </span>
        <Chevron open={open} />
      </button>
      {open && <div className="space-y-4">{children}</div>}
    </section>
  )
}

export function SwaggerProjectPreview({ contracts, groups }: SwaggerProjectPreviewProps) {
  const [view, setView] = React.useState<ProjectPreviewView>("visual")
  // null = no pending signal; true = expand all; false = collapse all
  const [allOpen, setAllOpen] = React.useState<boolean | null>(null)
  // Track whether all endpoints are currently expanded to decide button label
  const [endpointsOpen, setEndpointsOpen] = React.useState(false)

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

  function handleToggleAll() {
    const next = !endpointsOpen
    setEndpointsOpen(next)
    setAllOpen(next)
    // Reset signal after a tick so future individual toggles don't re-trigger
    setTimeout(() => setAllOpen(null), 0)
  }

  return (
    <div className="space-y-6">
      {/* Header + view toggle */}
      <div className="rounded-lg border border-border-subtle bg-surface px-5 py-4 shadow-brutal">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-text-muted">
              Preview All
            </p>
            <h2 className="text-xl font-semibold tracking-tight text-text-primary">
              Project API Docs
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {/* Expand / Collapse all endpoints — only in visual view */}
            {view === "visual" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleToggleAll}
                className="gap-1.5 font-mono text-xs text-text-muted hover:text-text-primary"
              >
                <ChevronsUpDown size={12} />
                {endpointsOpen ? "Collapse all" : "Expand all"}
              </Button>
            )}

            {/* Visual / Code toggle */}
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
            <div className="rounded-md border border-border-subtle bg-elevated px-4 py-2 text-right shadow-brutal-sm">
              <p className="text-[10px] uppercase tracking-[0.15em] text-text-muted">Endpoints</p>
              <p className="font-mono text-xl font-semibold text-text-primary">{contracts.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Code view — single combined OpenAPI document */}
      {view === "code" && (
        <ProjectCodePreview contracts={contracts} />
      )}

      {/* Visual view — per-contract cards grouped */}
      {view === "visual" && (
        <>
          {groupedContracts.map(({ group, contracts: groupContracts }) => {
            if (groupContracts.length === 0) return null
            return (
              <GroupSection
                key={group.id}
                label={group.name}
                count={groupContracts.length}
                allOpen={allOpen}
              >
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
                    allOpen={allOpen}
                  />
                ))}
              </GroupSection>
            )
          })}

          {ungroupedContracts.length > 0 && (
            <GroupSection
              label="Ungrouped"
              count={ungroupedContracts.length}
              allOpen={allOpen}
            >
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
                  allOpen={allOpen}
                />
              ))}
            </GroupSection>
          )}
        </>
      )}
    </div>
  )
}

// ─── Project-wide combined code preview ───────────────────────────────────────

function ProjectCodePreview({ contracts }: { contracts: Contract[] }) {
  const inputs = contracts.map((c) => ({
    method: c.method,
    path: c.path,
    querySchema: c.querySchema,
    parametersSchema: EMPTY_SCHEMA,
    headersSchema: EMPTY_SCHEMA,
    authSchema: EMPTY_SCHEMA,
    requestBodyFormat: c.requestBodyFormat,
    requestSchema: c.requestSchema,
    responseSchema: c.responseSchema,
  }))

  const projectObj = React.useMemo(
    () => generateProjectOpenApiObject(inputs, "Project API Docs"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contracts]
  )

  return (
    <OpenApiCodePreview
      // Pass first contract's shape as props — the component will use projectObj override
      method={contracts[0]?.method ?? "GET"}
      path={contracts[0]?.path ?? "/"}
      querySchema={EMPTY_SCHEMA}
      parametersSchema={EMPTY_SCHEMA}
      headersSchema={EMPTY_SCHEMA}
      authSchema={EMPTY_SCHEMA}
      requestBodyFormat="json"
      requestSchema={EMPTY_SCHEMA}
      responseSchema={EMPTY_SCHEMA}
      overrideObj={projectObj}
      exportFilename="project-openapi"
    />
  )
}
