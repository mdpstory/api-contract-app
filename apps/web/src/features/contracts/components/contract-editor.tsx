import * as React from "react"
import { Save, Trash2, Download, CheckCircle, Clock, History, FlaskConical, Eye } from "lucide-react"
import {
  useCreateContractGroup,
  useContractGroups,
  useContracts,
  useMoveContractGroup,
  useUpdateContract,
  useUpdateContractStatus,
  useDeleteContract,
} from "@/features/contracts/hooks"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SchemaEditor } from "./schema-editor"
import { JsonPreview } from "./json-preview"
import { SchemaLivePreview } from "./schema-live-preview"
import { HistoryTab } from "./history-tab"
import { ValidateTab } from "@/features/validation/components/validate-tab"
import { exportOpenApi } from "@/features/validation/api"
import { cn } from "@/lib/cn"
import { useToast } from "@/lib/toast"
import type { Contract, ContractSchema, HttpMethod, RequestBodyFormat } from "@repo/types"

// ─── Constants ────────────────────────────────────────────────────────────────

const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"]

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "method-get",
  POST: "method-post",
  PUT: "method-put",
  PATCH: "method-patch",
  DELETE: "method-delete",
}

const SELECT_CLS =
  "h-10 min-w-20 rounded-sm bg-transparent px-3 text-center font-mono text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors focus:outline-none"

// ─── Schema helpers ───────────────────────────────────────────────────────────

function normalizeSchema(schema: ContractSchema): ContractSchema {
  return {
    fields: schema.fields
      .map((f) => ({ ...f, name: f.name.trim() }))
      .filter((f) => f.name.length > 0),
  }
}

interface SchemaValidationResult {
  error: string | null
  invalidRowIndexes: number[]
}

function validateSchema(schema: ContractSchema, label: string): SchemaValidationResult {
  const seen = new Set<string>()
  const fieldTypes = new Map<string, ContractSchema["fields"][number]["type"]>()
  const pathIndexes = new Map<string, number>()

  function invalid(error: string, invalidRowIndexes: number[]): SchemaValidationResult {
    return { error, invalidRowIndexes }
  }

  for (const [i, field] of schema.fields.entries()) {
    const path = field.name.trim()
    if (!path) continue
    const segments = path.split(".")
    if (segments.some((s) => !s)) return invalid(`${label}: "${path}" is not a valid path.`, [i])
    if (seen.has(path)) {
      const existingIndex = pathIndexes.get(path)
      return invalid(`${label}: duplicate field "${path}".`, existingIndex === undefined ? [i] : [existingIndex, i])
    }

    for (let depth = 1; depth < segments.length; depth += 1) {
      const parentPath = segments.slice(0, depth).join(".")
      const parentType = fieldTypes.get(parentPath)
      if (parentType && parentType !== "object") {
        const parentIndex = pathIndexes.get(parentPath)
        return invalid(
          `${label}: "${parentPath}" must be type "object" before adding nested field "${path}".`,
          parentIndex === undefined ? [i] : [parentIndex, i]
        )
      }
    }

    for (const [existingPath, existingType] of fieldTypes) {
      if (existingPath.startsWith(`${path}.`) && field.type !== "object") {
        const childIndex = pathIndexes.get(existingPath)
        return invalid(
          `${label}: "${path}" must be type "object" because it already has nested fields.`,
          childIndex === undefined ? [i] : [i, childIndex]
        )
      }

      if (path.startsWith(`${existingPath}.`) && existingType !== "object") {
        const parentIndex = pathIndexes.get(existingPath)
        return invalid(
          `${label}: "${existingPath}" must be type "object" before adding nested field "${path}".`,
          parentIndex === undefined ? [i] : [parentIndex, i]
        )
      }
    }

    seen.add(path)
    fieldTypes.set(path, field.type)
    pathIndexes.set(path, i)
  }
  return { error: null, invalidRowIndexes: [] }
}

function getSchemaValidationError(schema: ContractSchema, label: string): string | null {
  return validateSchema(schema, label).error
}

// ─── ContractEditor ───────────────────────────────────────────────────────────

export interface ContractEditorProps {
  contract: Contract
  projectId: string
  /** Called after a successful delete. Use to e.g. close the tab or navigate away. */
  onDeleted?: () => void
  /** Initial active top-level tab */
  initialTab?: "definition" | "history" | "validate"
  /** Initial active definition sub-tab */
  initialDefinitionTab?: "query" | "request" | "response" | "preview"
}

export function ContractEditor({
  contract,
  projectId,
  onDeleted,
  initialTab = "definition",
  initialDefinitionTab = "query",
}: ContractEditorProps) {
  const { toast } = useToast()
  const { data: contracts = [] } = useContracts(projectId)
  const { data: groups = [] } = useContractGroups(projectId)
  const { mutate: moveContractGroup, isPending: isMovingContract } =
    useMoveContractGroup(projectId)

  const [activeTab, setActiveTab] = React.useState<"definition" | "history" | "validate">(initialTab)
  const [activeDefinitionTab, setActiveDefinitionTab] = React.useState<"query" | "parameters" | "headers" | "auth" | "body" | "response" | "preview">(initialDefinitionTab as "query" | "parameters" | "headers" | "auth" | "body" | "response" | "preview")

  const groupById = React.useMemo(
    () => new Map(groups.map((group) => [group.id, group])),
    [groups]
  )
  const groupCounts = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of contracts) {
      if (item.groupId && groupById.has(item.groupId)) {
        counts.set(item.groupId, (counts.get(item.groupId) ?? 0) + 1)
      }
    }
    return counts
  }, [contracts, groupById])

  const [createGroupOpen, setCreateGroupOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)

  // ── Local form state ──
  const [method, setMethod] = React.useState<HttpMethod>(contract.method)
  const [path, setPath] = React.useState(contract.path)
  const [querySchema, setQuerySchema] = React.useState<ContractSchema>(contract.querySchema)
  const [parametersSchema, setParametersSchema] = React.useState<ContractSchema>(contract.parametersSchema)
  const [headersSchema, setHeadersSchema] = React.useState<ContractSchema>(contract.headersSchema)
  const [authSchema, setAuthSchema] = React.useState<ContractSchema>(contract.authSchema)
  const [requestBodyFormat, setRequestBodyFormat] = React.useState<RequestBodyFormat>(contract.requestBodyFormat)
  const [requestSchema, setRequestSchema] = React.useState<ContractSchema>(contract.requestSchema)
  const [responseSchema, setResponseSchema] = React.useState<ContractSchema>(contract.responseSchema)
  const [queryPreviewMode, setQueryPreviewMode] = React.useState<"typescript" | "jsonc">("typescript")
  const [requestPreviewMode, setRequestPreviewMode] = React.useState<"typescript" | "jsonc">("typescript")
  const [responsePreviewMode, setResponsePreviewMode] = React.useState<"typescript" | "jsonc">("typescript")

  const queryValidation = React.useMemo(
    () => validateSchema(normalizeSchema(querySchema), "Query"),
    [querySchema]
  )
  const parametersValidation = React.useMemo(
    () => validateSchema(normalizeSchema(parametersSchema), "Parameters"),
    [parametersSchema]
  )
  const headersValidation = React.useMemo(
    () => validateSchema(normalizeSchema(headersSchema), "Headers"),
    [headersSchema]
  )
  const authValidation = React.useMemo(
    () => validateSchema(normalizeSchema(authSchema), "Authorization"),
    [authSchema]
  )
  const requestValidation = React.useMemo(
    () => validateSchema(normalizeSchema(requestSchema), "Request Body"),
    [requestSchema]
  )
  const responseValidation = React.useMemo(
    () => validateSchema(normalizeSchema(responseSchema), "Response"),
    [responseSchema]
  )

  React.useEffect(() => {
    setMethod(contract.method)
    setPath(contract.path)
    setQuerySchema(contract.querySchema)
    setParametersSchema(contract.parametersSchema)
    setHeadersSchema(contract.headersSchema)
    setAuthSchema(contract.authSchema)
    setRequestBodyFormat(contract.requestBodyFormat)
    setRequestSchema(contract.requestSchema)
    setResponseSchema(contract.responseSchema)
    setDeleteOpen(false)
  }, [contract])

  const isDirty =
    method !== contract.method ||
    path !== contract.path ||
    JSON.stringify(querySchema) !== JSON.stringify(contract.querySchema) ||
    JSON.stringify(parametersSchema) !== JSON.stringify(contract.parametersSchema) ||
    JSON.stringify(headersSchema) !== JSON.stringify(contract.headersSchema) ||
    JSON.stringify(authSchema) !== JSON.stringify(contract.authSchema) ||
    requestBodyFormat !== contract.requestBodyFormat ||
    JSON.stringify(requestSchema) !== JSON.stringify(contract.requestSchema) ||
    JSON.stringify(responseSchema) !== JSON.stringify(contract.responseSchema)

  React.useEffect(() => {
    if (!isDirty) return
    function handleBeforeUnload(e: BeforeUnloadEvent) { e.preventDefault() }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [isDirty])

  const { mutate: save, isPending: isSaving } = useUpdateContract(projectId, contract.id)
  const { mutate: updateStatus, isPending: isUpdatingStatus } = useUpdateContractStatus(projectId, contract.id)
  const { mutate: remove, isPending: isDeleting } = useDeleteContract(projectId)

  function handleSave() {
    const normalizedPath = path.trim()
    const normQuery = normalizeSchema(querySchema)
    const normParams = normalizeSchema(parametersSchema)
    const normHeaders = normalizeSchema(headersSchema)
    const normAuth = normalizeSchema(authSchema)
    const normReq = normalizeSchema(requestSchema)
    const normRes = normalizeSchema(responseSchema)

    if (!normalizedPath) { toast({ title: "Path cannot be empty", variant: "error" }); return }
    const queryErr = getSchemaValidationError(normQuery, "Query")
    if (queryErr) { toast({ title: "Invalid schema", description: queryErr, variant: "error" }); return }
    const paramsErr = getSchemaValidationError(normParams, "Parameters")
    if (paramsErr) { toast({ title: "Invalid schema", description: paramsErr, variant: "error" }); return }
    const headersErr = getSchemaValidationError(normHeaders, "Headers")
    if (headersErr) { toast({ title: "Invalid schema", description: headersErr, variant: "error" }); return }
    const authErr = getSchemaValidationError(normAuth, "Authorization")
    if (authErr) { toast({ title: "Invalid schema", description: authErr, variant: "error" }); return }
    const reqErr = getSchemaValidationError(normReq, "Request Body")
    if (reqErr) { toast({ title: "Invalid schema", description: reqErr, variant: "error" }); return }
    const resErr = getSchemaValidationError(normRes, "Response")
    if (resErr) { toast({ title: "Invalid schema", description: resErr, variant: "error" }); return }

    if (normalizedPath !== path) setPath(normalizedPath)
    if (JSON.stringify(normQuery) !== JSON.stringify(querySchema)) setQuerySchema(normQuery)
    if (JSON.stringify(normParams) !== JSON.stringify(parametersSchema)) setParametersSchema(normParams)
    if (JSON.stringify(normHeaders) !== JSON.stringify(headersSchema)) setHeadersSchema(normHeaders)
    if (JSON.stringify(normAuth) !== JSON.stringify(authSchema)) setAuthSchema(normAuth)
    if (JSON.stringify(normReq) !== JSON.stringify(requestSchema)) setRequestSchema(normReq)
    if (JSON.stringify(normRes) !== JSON.stringify(responseSchema)) setResponseSchema(normRes)

    save(
      {
        method, path: normalizedPath,
        querySchema: normQuery, parametersSchema: normParams,
        headersSchema: normHeaders, authSchema: normAuth,
        requestBodyFormat, requestSchema: normReq, responseSchema: normRes,
      },
      {
        onSuccess: () => toast({ title: "Saved", variant: "success" }),
        onError: (err) => toast({ title: "Save failed", description: err.message, variant: "error" }),
      }
    )
  }

  function handleToggleStatus() {
    const next = contract.status === "draft" ? "approved" : "draft"
    updateStatus(next, {
      onSuccess: () => toast({ title: `Marked as ${next}`, variant: "success" }),
      onError: (err) => toast({ title: "Error", description: err.message, variant: "error" }),
    })
  }

  function handleDelete() {
    remove(contract.id, {
      onSuccess: () => {
        setDeleteOpen(false)
        toast({ title: "Endpoint deleted", variant: "success" })
        onDeleted?.()
      },
      onError: (err) => toast({ title: "Delete failed", description: err.message, variant: "error" }),
    })
  }

  function handleExport() {
    exportOpenApi(projectId, contract.id).catch(() =>
      toast({ title: "Export failed", variant: "error" })
    )
  }

  // Suppress unused warning — kept for future sidebar group move support in inline mode
  void moveContractGroup
  void isMovingContract
  void groupCounts

  return (
    <div className="min-w-0 flex flex-col flex-1">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-surface px-5 py-2.5 font-mono">
        {/* Left: status badge + dirty indicator */}
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant={contract.status === "approved" ? "approved" : "draft"}>
            {contract.status}
          </Badge>
          {isDirty && (
            <span className="text-[11px] font-medium text-warning">
              Unsaved changes
            </span>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5 font-mono">
          {/* Approve / Mark draft — keeps text label */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleToggleStatus}
            disabled={isUpdatingStatus}
          >
            {contract.status === "draft" ? (
              <><CheckCircle size={12} />Approve</>
            ) : (
              <><Clock size={12} />Mark draft</>
            )}
          </Button>

          {/* Export */}
          <Button variant="ghost" size="icon" onClick={handleExport} title="Export OpenAPI">
            <Download size={13} />
          </Button>

          {/* Preview toggle */}
          <Button
            variant="ghost"
            size="icon"
            title="Preview"
            onClick={() => setActiveDefinitionTab(activeDefinitionTab === "preview" ? "query" : "preview")}
            className={cn(activeDefinitionTab === "preview" && "text-accent bg-accent/10")}
          >
            <Eye size={13} />
          </Button>

          {/* History toggle */}
          <Button
            variant="ghost"
            size="icon"
            title="History"
            onClick={() => setActiveTab(activeTab === "history" ? "definition" : "history")}
            className={cn(activeTab === "history" && "text-accent bg-accent/10")}
          >
            <History size={13} />
          </Button>

          {/* Validate toggle */}
          <Button
            variant="ghost"
            size="icon"
            title="Validate"
            onClick={() => setActiveTab(activeTab === "validate" ? "definition" : "validate")}
            className={cn(activeTab === "validate" && "text-accent bg-accent/10")}
          >
            <FlaskConical size={13} />
          </Button>

          {/* Save */}
          <Button
            variant="ghost"
            size="icon"
            title={isSaving ? "Saving..." : "Save"}
            onClick={handleSave}
            disabled={isSaving || !isDirty}
          >
            <Save size={13} />
          </Button>

          {/* Delete */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteOpen(true)}
            disabled={isDeleting}
            title="Delete endpoint"
            className="text-text-muted hover:text-error hover:bg-error/8"
          >
            <Trash2 size={13} />
          </Button>
        </div>
      </div>

      {/* ── Definition (always visible) ── */}
      <div className="flex-1 px-5 py-4 space-y-4">
        {/* Method + Path */}
        <section className="overflow-hidden rounded-md border border-border-subtle bg-surface font-mono shadow-brutal-sm">
          <div className="border-b border-border-subtle bg-elevated px-4 py-3">
            <div className="flex flex-wrap items-stretch gap-2">
              <div className={cn(
                "flex h-10 min-w-20 items-center justify-center rounded-sm",
                METHOD_COLORS[method]
              )}>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as HttpMethod)}
                  className={cn(SELECT_CLS, METHOD_COLORS[method])}
                >
                  {HTTP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <input
                type="text"
                placeholder="/api/endpoint"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                className="flex min-h-10 min-w-[220px] flex-1 rounded-sm border border-border-subtle bg-base px-3 font-mono text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* Schema sub-tab strip — hidden when preview is active */}
        {activeDefinitionTab !== "preview" && (
          <div className="flex items-center gap-0 border-b border-border-subtle">
            {(
              [
                { key: "query",      label: "Query" },
                { key: "parameters", label: "Parameters" },
                { key: "headers",    label: "Headers" },
                { key: "auth",       label: "Authorization" },
                { key: "body",       label: "Body" },
                { key: "response",   label: "Response" },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveDefinitionTab(key)}
                className={cn(
                  "relative px-4 py-2 font-mono text-xs font-medium transition-colors",
                  activeDefinitionTab === key
                    ? "text-text-primary"
                    : "text-text-muted hover:text-text-secondary",
                )}
              >
                {label}
                {activeDefinitionTab === key && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Query */}
        {activeDefinitionTab === "query" && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)] xl:items-start">
            <SchemaEditor
              value={querySchema}
              onChange={setQuerySchema}
              placeholder="queryKey"
              error={queryValidation.error}
              invalidRowIndexes={queryValidation.invalidRowIndexes}
            />
            <SchemaLivePreview
              label="Preview"
              schema={querySchema}
              emptyMessage="Add query fields to generate a live preview"
              mode={queryPreviewMode}
              onModeChange={setQueryPreviewMode}
            />
          </div>
        )}

        {/* Parameters */}
        {activeDefinitionTab === "parameters" && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)] xl:items-start">
            <SchemaEditor
              value={parametersSchema}
              onChange={setParametersSchema}
              placeholder="paramName"
              error={parametersValidation.error}
              invalidRowIndexes={parametersValidation.invalidRowIndexes}
            />
            <SchemaLivePreview
              label="Preview"
              schema={parametersSchema}
              emptyMessage="Add path parameters to generate a live preview"
              mode={queryPreviewMode}
              onModeChange={setQueryPreviewMode}
            />
          </div>
        )}

        {/* Headers */}
        {activeDefinitionTab === "headers" && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)] xl:items-start">
            <SchemaEditor
              value={headersSchema}
              onChange={setHeadersSchema}
              placeholder="Header-Name"
              error={headersValidation.error}
              invalidRowIndexes={headersValidation.invalidRowIndexes}
            />
            <SchemaLivePreview
              label="Preview"
              schema={headersSchema}
              emptyMessage="Add headers to generate a live preview"
              mode={queryPreviewMode}
              onModeChange={setQueryPreviewMode}
            />
          </div>
        )}

        {/* Authorization */}
        {activeDefinitionTab === "auth" && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)] xl:items-start">
            <SchemaEditor
              value={authSchema}
              onChange={setAuthSchema}
              placeholder="fieldName"
              error={authValidation.error}
              invalidRowIndexes={authValidation.invalidRowIndexes}
            />
            <SchemaLivePreview
              label="Preview"
              schema={authSchema}
              emptyMessage="Add authorization fields to generate a live preview"
              mode={queryPreviewMode}
              onModeChange={setQueryPreviewMode}
            />
          </div>
        )}

        {/* Body */}
        {activeDefinitionTab === "body" && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)] xl:items-start">
            <div className="space-y-3">
              <section className="overflow-hidden rounded-md border border-border-subtle bg-surface font-mono shadow-brutal-sm">
                <div className="border-b border-border-subtle bg-elevated px-3 py-2">
                  <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">
                    Body Format
                  </span>
                </div>
                <div className="flex gap-2 p-3">
                  {(["json", "form-data"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setRequestBodyFormat(fmt)}
                      className={cn(
                        "rounded-md border px-3 py-1.5 font-mono text-xs uppercase tracking-[0.12em] transition-colors",
                        requestBodyFormat === fmt
                          ? "border-accent/30 bg-accent/12 text-accent"
                          : "border-border-subtle text-text-muted hover:border-border-default hover:text-text-primary"
                      )}
                    >
                      {fmt === "json" ? "JSON" : "Form Data"}
                    </button>
                  ))}
                </div>
              </section>
              <SchemaEditor
                value={requestSchema}
                onChange={setRequestSchema}
                placeholder={requestBodyFormat === "form-data" ? "fieldName" : (requestPreviewMode === "jsonc" ? "parent.child.field" : "fieldName")}
                error={requestValidation.error}
                invalidRowIndexes={requestValidation.invalidRowIndexes}
              />
            </div>
            <SchemaLivePreview
              label="Preview"
              schema={requestSchema}
              emptyMessage="Add request fields to generate a live preview"
              mode={requestPreviewMode}
              onModeChange={setRequestPreviewMode}
            />
          </div>
        )}

        {/* Response */}
        {activeDefinitionTab === "response" && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)] xl:items-start">
            <SchemaEditor
              value={responseSchema}
              onChange={setResponseSchema}
              placeholder={responsePreviewMode === "jsonc" ? "parent.child.field" : "fieldName"}
              error={responseValidation.error}
              invalidRowIndexes={responseValidation.invalidRowIndexes}
            />
            <SchemaLivePreview
              label="Preview"
              schema={responseSchema}
              emptyMessage="Add response fields to generate a live preview"
              mode={responsePreviewMode}
              onModeChange={setResponsePreviewMode}
            />
          </div>
        )}

        {/* Preview */}
        {activeDefinitionTab === "preview" && (
          <JsonPreview
            querySchema={querySchema}
            requestBodyFormat={requestBodyFormat}
            requestSchema={requestSchema}
            responseSchema={responseSchema}
            method={method}
            path={path}
          />
        )}

        {/* History panel — shown when history icon is toggled */}
        {activeTab === "history" && (
          <div className="border-t border-border-subtle pt-4">
            <HistoryTab projectId={projectId} contractId={contract.id} />
          </div>
        )}

        {/* Validate panel — shown when validate icon is toggled */}
        {activeTab === "validate" && (
          <div className="border-t border-border-subtle pt-4">
            <ValidateTab
              projectId={projectId}
              contractId={contract.id}
              defaultMethod={method}
              defaultPath={path}
              requestBodyFormat={requestBodyFormat}
              requestSchema={requestSchema}
            />
          </div>
        )}
      </div>

      {/* Create group dialog */}
      <Dialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
        <CreateGroupDialogContent
          key={createGroupOpen ? "open" : "closed"}
          projectId={projectId}
          onClose={() => setCreateGroupOpen(false)}
        />
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete endpoint</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">
              Permanently delete{" "}
              <code className="font-mono text-xs bg-elevated px-1.5 py-0.5 rounded border border-border-default text-text-primary">
                {contract.method} {contract.path}
              </code>
              ? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Create Group Dialog ──────────────────────────────────────────────────────

function CreateGroupDialogContent({
  projectId,
  onClose,
}: {
  projectId: string
  onClose: () => void
}) {
  const [name, setName] = React.useState("")
  const { mutate: createGroup, isPending } = useCreateContractGroup(projectId)
  const { toast } = useToast()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    createGroup(
      { name },
      {
        onSuccess: () => {
          toast({ title: "Group created", variant: "success" })
          onClose()
        },
        onError: (err) =>
          toast({ title: "Error", description: err.message, variant: "error" }),
      }
    )
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New group</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          placeholder="Payments"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          required
        />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isPending || !name.trim()}>
            {isPending ? "Creating..." : "Create group"}
          </Button>
        </div>
      </form>
    </DialogContent>
  )
}
