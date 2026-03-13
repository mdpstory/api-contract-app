import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router"
import * as React from "react"
import { Save, Trash2, Download, CheckCircle, Clock, AlertTriangle, ArrowLeft } from "lucide-react"
import { getOrFetchMe } from "@/features/auth/hooks"
import { useProject } from "@/features/projects/hooks"
import {
  useContract,
  useCreateContractGroup,
  useContractGroups,
  useContracts,
  useMoveContractGroup,
  useUpdateContract,
  useUpdateContractStatus,
  useDeleteContract,
} from "@/features/contracts/hooks"
import { AppLayout } from "@/components/layout/app-layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SchemaEditor } from "@/features/contracts/components/schema-editor"
import { JsonPreview } from "@/features/contracts/components/json-preview"
import { SchemaLivePreview } from "@/features/contracts/components/schema-live-preview"
import { HistoryTab } from "@/features/contracts/components/history-tab"
import { ValidateTab } from "@/features/validation/components/validate-tab"
import { exportOpenApi } from "@/features/validation/api"
import { cn } from "@/lib/cn"
import { useToast } from "@/lib/toast"
import type { Contract, ContractSchema, HttpMethod, RequestBodyFormat } from "@repo/types"

export const Route = createFileRoute(
  "/projects/$projectId/contracts/$contractId"
)({
  validateSearch: (search: Record<string, unknown>) => ({
    tab:
      search.tab === "history" || search.tab === "validate"
        ? search.tab
        : "definition",
    definitionTab:
      search.definitionTab === "request" || search.definitionTab === "query" || search.definitionTab === "response" || search.definitionTab === "preview"
        ? search.definitionTab
        : "query",
    listSection: search.listSection === "preview" ? "preview" : "endpoints",
    listFilter:
      search.listFilter === "draft" || search.listFilter === "approved"
        ? search.listFilter
        : "all",
    listQ: typeof search.listQ === "string" ? search.listQ : "",
    listGroup: typeof search.listGroup === "string" ? search.listGroup : "__all__",
  }),
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await getOrFetchMe(queryClient)
    if (!user) throw redirect({ to: "/auth/login" })
  },
  component: ContractDetailPage,
})

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

function ContractDetailPage() {
  const { projectId, contractId } = Route.useParams()
  const { data: contract, isLoading, isError } = useContract(projectId, contractId)

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-3 max-w-3xl">
          <div className="h-4 w-48 rounded bg-elevated animate-pulse" />
          <div className="h-3 w-32 rounded bg-elevated animate-pulse" />
        </div>
      </AppLayout>
    )
  }

  if (isError || !contract) {
    return (
      <AppLayout>
        <div className="flex items-center gap-2 text-sm text-text-secondary py-10">
          <AlertTriangle size={14} className="text-error shrink-0" />
          Could not load contract. Please go back and try again.
        </div>
      </AppLayout>
    )
  }

  return <ContractEditor contract={contract} projectId={projectId} />
}

// ─── Contract Editor ──────────────────────────────────────────────────────────

function ContractEditor({ contract, projectId }: { contract: Contract; projectId: string }) {
  const { toast } = useToast()
  const navigate = useNavigate()
  const searchState = Route.useSearch()
  const { data: project } = useProject(projectId)
  const { data: contracts = [] } = useContracts(projectId)
  const { data: groups = [] } = useContractGroups(projectId)
  const { mutate: moveContractGroup, isPending: isMovingContract } =
    useMoveContractGroup(projectId)

  const activeTab           = searchState.tab ?? "definition"
  const activeDefinitionTab = searchState.definitionTab ?? "query"

  const backSection = searchState.listSection === "preview" ? "preview" : "endpoints"
  const endpointBackSearch = {
    filter: searchState.listFilter === "draft" || searchState.listFilter === "approved" ? searchState.listFilter : "all",
    q:      searchState.listQ ?? "",
    group:  searchState.listGroup ?? "__all__",
  } as const

  const backNavigation = backSection === "preview"
    ? {
        to: "/projects/$projectId/preview" as const,
        params: { projectId },
      }
    : {
        to: "/projects/$projectId/endpoints" as const,
        params: { projectId },
        search: endpointBackSearch,
      }

  function updateSearch(patch: Partial<{ tab: "definition" | "history" | "validate"; definitionTab: "request" | "query" | "response" | "preview" }>) {
    void navigate({
      to: "/projects/$projectId/contracts/$contractId",
      params: { projectId, contractId: contract.id },
      replace: true,
      search: { ...searchState, ...patch },
    })
  }

  const groupName = contract.groupId
    ? (groups.find((g) => g.id === contract.groupId)?.name ?? "Ungrouped")
    : "Ungrouped"
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
  const ungroupedCount = contracts.filter(
    (item) => !item.groupId || !groupById.has(item.groupId)
  ).length

  function moveContractToGroup(contractId: string, nextGroupId: string | null) {
    moveContractGroup(
      { contractId, groupId: nextGroupId },
      {
        onSuccess: () => {
          const targetName =
            nextGroupId === null
              ? "Ungrouped"
              : (groupById.get(nextGroupId)?.name ?? "Group")
          toast({ title: "Moved to " + targetName, variant: "success" })
        },
        onError: (err) =>
          toast({ title: "Error", description: err.message, variant: "error" }),
      }
    )
  }

  // ── Local form state (manual save) ──
  const [method, setMethod]               = React.useState<HttpMethod>(contract.method)
  const [path, setPath]                   = React.useState(contract.path)
  const [querySchema, setQuerySchema] = React.useState<ContractSchema>(contract.querySchema)
  const [requestBodyFormat, setRequestBodyFormat] = React.useState<RequestBodyFormat>(contract.requestBodyFormat)
  const [requestSchema, setRequestSchema] = React.useState<ContractSchema>(contract.requestSchema)
  const [responseSchema, setResponseSchema] = React.useState<ContractSchema>(contract.responseSchema)
  const [queryPreviewMode, setQueryPreviewMode] = React.useState<"typescript" | "jsonc">("typescript")
  const [requestPreviewMode, setRequestPreviewMode] = React.useState<"typescript" | "jsonc">("typescript")
  const [responsePreviewMode, setResponsePreviewMode] = React.useState<"typescript" | "jsonc">("typescript")
  const [createGroupOpen, setCreateGroupOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen]       = React.useState(false)

  const queryValidation = React.useMemo(
    () => validateSchema(normalizeSchema(querySchema), "Query"),
    [querySchema]
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
    setRequestBodyFormat(contract.requestBodyFormat)
    setRequestSchema(contract.requestSchema)
    setResponseSchema(contract.responseSchema)
    setDeleteOpen(false)
  }, [contract])

  const isDirty =
    method !== contract.method ||
    path !== contract.path ||
    JSON.stringify(querySchema) !== JSON.stringify(contract.querySchema) ||
    requestBodyFormat !== contract.requestBodyFormat ||
    JSON.stringify(requestSchema) !== JSON.stringify(contract.requestSchema) ||
    JSON.stringify(responseSchema) !== JSON.stringify(contract.responseSchema)

  // Warn browser before unload with unsaved changes
  React.useEffect(() => {
    if (!isDirty) return
    function handleBeforeUnload(e: BeforeUnloadEvent) { e.preventDefault() }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [isDirty])

  const { mutate: save, isPending: isSaving }                     = useUpdateContract(projectId, contract.id)
  const { mutate: updateStatus, isPending: isUpdatingStatus }     = useUpdateContractStatus(projectId, contract.id)
  const { mutate: remove, isPending: isDeleting }                 = useDeleteContract(projectId)

  function handleSave() {
    const normalizedPath   = path.trim()
    const normQuery        = normalizeSchema(querySchema)
    const normReq          = normalizeSchema(requestSchema)
    const normRes          = normalizeSchema(responseSchema)

    if (!normalizedPath) { toast({ title: "Path cannot be empty", variant: "error" }); return }
    const queryErr = getSchemaValidationError(normQuery, "Query")
    if (queryErr)  { toast({ title: "Invalid schema", description: queryErr, variant: "error" }); return }
    const reqErr = getSchemaValidationError(normReq, "Request Body")
    if (reqErr)  { toast({ title: "Invalid schema", description: reqErr, variant: "error" }); return }
    const resErr = getSchemaValidationError(normRes, "Response")
    if (resErr)  { toast({ title: "Invalid schema", description: resErr, variant: "error" }); return }

    if (normalizedPath !== path) setPath(normalizedPath)
    if (JSON.stringify(normQuery) !== JSON.stringify(querySchema)) setQuerySchema(normQuery)
    if (JSON.stringify(normReq) !== JSON.stringify(requestSchema))  setRequestSchema(normReq)
    if (JSON.stringify(normRes) !== JSON.stringify(responseSchema)) setResponseSchema(normRes)

    save(
      { method, path: normalizedPath, querySchema: normQuery, requestBodyFormat, requestSchema: normReq, responseSchema: normRes },
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
        void navigate(backNavigation)
      },
      onError: (err) => toast({ title: "Delete failed", description: err.message, variant: "error" }),
    })
  }

  function handleExport() {
    exportOpenApi(projectId, contract.id).catch(() =>
      toast({ title: "Export failed", variant: "error" })
    )
  }

  return (
    <AppLayout
      mainClassName="p-0"
      sidebar={{
        kind: "project",
        projectId,
        projectName: project?.name,
        projectDescription: project?.description,
        active: "endpoints",
        endpointSearch: endpointBackSearch,
        groups,
        contracts,
        selectedGroup: endpointBackSearch.group,
        activeContractId: contract.id,
        onCreateGroup: () => setCreateGroupOpen(true),
        onMoveContractGroup: moveContractToGroup,
        isMovingContract,
        groupCounts,
        ungroupedCount,
      }}
      breadcrumbs={[
        { label: project?.name ?? "...", href: `/projects/${projectId}/${backSection}` },
        { label: groupName },
        { label: `${contract.method} ${contract.path}` },
      ]}
    >
      <div className="min-h-[calc(100vh-3rem)] min-w-0 flex flex-col">
          {/* Sticky top bar */}
          <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-surface px-5 py-2.5 font-mono">
            {/* Left: back + identity */}
            <div className="flex items-center gap-3 min-w-0">
              <Link
                {...backNavigation}
                className="flex shrink-0 items-center gap-1 text-xs text-text-muted transition-colors hover:text-text-secondary"
              >
                <ArrowLeft size={12} />
                Back
              </Link>
              <span className="text-text-muted text-xs">·</span>
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
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-1.5 font-mono">
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

              <Button variant="ghost" size="icon" onClick={handleExport} title="Export OpenAPI">
                <Download size={13} />
              </Button>

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

              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || !isDirty}
              >
                <Save size={12} />
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>

          {/* Main tabs */}
          <div className="flex-1 px-5 py-4">
            <Tabs
              value={activeTab}
              onValueChange={(v) => updateSearch({ tab: v as "definition" | "history" | "validate" })}
            >
              <TabsList className="font-mono">
                <TabsTrigger value="definition">Definition</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="validate">Validate</TabsTrigger>
              </TabsList>

              {/* ── Definition ── */}
              <TabsContent value="definition" className="space-y-4">
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

                {/* Schema sub-tabs */}
                <Tabs
                  value={activeDefinitionTab}
                  onValueChange={(v) => updateSearch({ definitionTab: v as "request" | "query" | "response" | "preview" })}
                >
                  <TabsList className="font-mono">
                    <TabsTrigger value="query">Query</TabsTrigger>
                    <TabsTrigger value="request">Request body</TabsTrigger>
                    <TabsTrigger value="response">Response</TabsTrigger>
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                  </TabsList>

                  <TabsContent value="query">
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
                  </TabsContent>
                  <TabsContent value="request">
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)] xl:items-start">
                      <div className="space-y-3">
                        <section className="overflow-hidden rounded-md border border-border-subtle bg-surface font-mono shadow-brutal-sm">
                          <div className="border-b border-border-subtle bg-elevated px-3 py-2">
                            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">
                              Body Format
                            </span>
                          </div>
                          <div className="flex gap-2 p-3">
                            <button
                              type="button"
                              onClick={() => setRequestBodyFormat("json")}
                              className={cn(
                                "rounded-md border px-3 py-1.5 font-mono text-xs uppercase tracking-[0.12em] transition-colors",
                                requestBodyFormat === "json"
                                  ? "border-accent/30 bg-accent/12 text-accent"
                                  : "border-border-subtle text-text-muted hover:border-border-default hover:text-text-primary"
                              )}
                            >
                              JSON
                            </button>
                            <button
                              type="button"
                              onClick={() => setRequestBodyFormat("form-data")}
                              className={cn(
                                "rounded-md border px-3 py-1.5 font-mono text-xs uppercase tracking-[0.12em] transition-colors",
                                requestBodyFormat === "form-data"
                                  ? "border-accent/30 bg-accent/12 text-accent"
                                  : "border-border-subtle text-text-muted hover:border-border-default hover:text-text-primary"
                              )}
                            >
                              Form Data
                            </button>
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
                  </TabsContent>
                  <TabsContent value="response">
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
                  </TabsContent>
                  <TabsContent value="preview">
                    <JsonPreview querySchema={querySchema} requestBodyFormat={requestBodyFormat} requestSchema={requestSchema} responseSchema={responseSchema} method={method} path={path} />
                  </TabsContent>
                </Tabs>
              </TabsContent>

              {/* ── History ── */}
              <TabsContent value="history">
                <HistoryTab projectId={projectId} contractId={contract.id} />
              </TabsContent>

              {/* ── Validate ── */}
              <TabsContent value="validate">
                <ValidateTab projectId={projectId} contractId={contract.id} defaultMethod={method} defaultPath={path} requestBodyFormat={requestBodyFormat} requestSchema={requestSchema} />
              </TabsContent>
            </Tabs>
          </div>
      </div>

      {/* Delete dialog */}
      <Dialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
        <CreateGroupDialogContent
          key={createGroupOpen ? "open" : "closed"}
          projectId={projectId}
          onClose={() => setCreateGroupOpen(false)}
        />
      </Dialog>

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
    </AppLayout>
  )
}

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
