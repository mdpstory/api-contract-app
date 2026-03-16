import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
} from "@tanstack/react-router"
import * as React from "react"
import {
  Plus,
  AlertTriangle,
  Eye,
  FileSliders,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { JsonPreview } from "@/features/contracts/components/json-preview"
import { useProject } from "@/features/projects/hooks"
import {
  ALL_GROUP_FILTER,
  type GroupFilter,
  UNGROUPED_GROUP_FILTER,
} from "@/features/projects/lib/group-filters"
import {
  useContract,
  useContractGroups,
  useContracts,
  useCreateContract,
  useCreateContractGroup,
  useDeleteContractGroup,
  useMoveContractGroup,
  useUpdateContractGroup,
} from "@/features/contracts/hooks"
import { AppLayout } from "@/components/layout/app-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SwaggerProjectPreview } from "@/features/contracts/components/swagger-preview"
import { ContractEditor } from "@/features/contracts/components/contract-editor"
import { TabBar, type RequestTab } from "@/features/contracts/components/tab-bar"
import { SchemaEditor } from "@/features/contracts/components/schema-editor"
import { SchemaLivePreview } from "@/features/contracts/components/schema-live-preview"
import { useToast } from "@/lib/toast"
import type { ContractGroup, ContractSchema, HttpMethod, RequestBodyFormat } from "@repo/types"

export const Route = createFileRoute("/projects/$projectId")({
  component: ProjectLayout,
})

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET:    "method-get",
  POST:   "method-post",
  PUT:    "method-put",
  PATCH:  "method-patch",
  DELETE: "method-delete",
}

// Shared select styles — consistent height, border, background
const SELECT_CLS =
  "h-8 rounded border border-border-default bg-elevated px-2.5 text-sm text-text-primary transition-colors focus:border-accent focus:outline-none"

type FilterStatus = "all" | "draft" | "approved"
type ProjectSection = "endpoints" | "preview"
export interface EndpointListSearch {
  filter: FilterStatus
  q: string
  group: GroupFilter
}

function ProjectLayout() {
  return <Outlet />
}

export function ProjectSectionPage({
  projectId,
  activeSection,
  searchState,
}: {
  projectId: string
  activeSection: ProjectSection
  searchState: EndpointListSearch
}) {
  const navigate = useNavigate()
  const { data: project } = useProject(projectId)
  const { data: contracts = [] } = useContracts(projectId)
  const { data: groups = [] } = useContractGroups(projectId)

  // ── Tab state ──
  const blankTabCounter = React.useRef(0)

  function makeBlankTab(): RequestTab {
    blankTabCounter.current += 1
    return {
      kind: "blank",
      id: `blank-${blankTabCounter.current}`,
      label: `Untitled ${blankTabCounter.current}`,
    }
  }

  const initialTab = makeBlankTab()
  const [openTabs, setOpenTabs] = React.useState<RequestTab[]>([initialTab])
  const [activeTabId, setActiveTabId] = React.useState<string | null>(initialTab.id)

  function openContractTab(contractId: string) {
    const existing = openTabs.find(
      (t) => t.kind === "contract" && t.contractId === contractId
    )
    if (existing) {
      setActiveTabId(existing.id)
      return
    }
    const contract = contracts.find((c) => c.id === contractId)
    if (!contract) return
    const tab: RequestTab = {
      kind: "contract",
      id: contractId,
      contractId,
      label: contract.path,
      method: contract.method,
    }
    setOpenTabs((prev) => [...prev, tab])
    setActiveTabId(tab.id)
  }

  function openBlankTab() {
    const tab = makeBlankTab()
    setOpenTabs((prev) => [...prev, tab])
    setActiveTabId(tab.id)
  }

  function closeTab(id: string) {
    setOpenTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id)
      const next = prev.filter((t) => t.id !== id)
      if (next.length === 0) {
        // Always keep at least one blank tab open
        const fallback = makeBlankTab()
        setActiveTabId(fallback.id)
        return [fallback]
      }
      if (activeTabId === id) {
        const neighbour = next[idx] ?? next[idx - 1] ?? null
        setActiveTabId(neighbour?.id ?? null)
      }
      return next
    })
  }

  const [createGroupOpen, setCreateGroupOpen] = React.useState(false)
  const [renameGroupTarget, setRenameGroupTarget] = React.useState<ContractGroup | null>(null)
  const [deleteGroupTarget, setDeleteGroupTarget] = React.useState<ContractGroup | null>(null)

  const { mutate: moveContractGroup, isPending: isMovingContract } = useMoveContractGroup(projectId)
  const { toast } = useToast()

  const filter = searchState.filter
  const search = searchState.q
  const groupFilter = searchState.group

  function updateEndpointSearch(
    patch: Partial<{ filter: FilterStatus; q: string; group: string }>
  ) {
    void navigate({
      to: "/projects/$projectId/endpoints",
      params: { projectId },
      replace: true,
      search: { ...searchState, ...patch },
    })
  }

  const groupById = React.useMemo(
    () => new Map(groups.map((g) => [g.id, g])),
    [groups]
  )

  // Auto-clear invalid group filter
  React.useEffect(() => {
    if (groupFilter === ALL_GROUP_FILTER || groupFilter === UNGROUPED_GROUP_FILTER) return
    if (!groups.some((g) => g.id === groupFilter)) updateEndpointSearch({ group: ALL_GROUP_FILTER })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupFilter, groups])

  const groupCounts = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of contracts) {
      if (c.groupId && groupById.has(c.groupId)) {
        counts.set(c.groupId, (counts.get(c.groupId) ?? 0) + 1)
      }
    }
    return counts
  }, [contracts, groupById])

  const ungroupedCount = contracts.filter((c) => !c.groupId || !groupById.has(c.groupId)).length

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

  const endpointSearchParams = { filter, q: search, group: groupFilter }

  return (
    <AppLayout
      mainClassName="p-0"
      sidebar={{
        kind: "project",
        projectId,
        projectName: project?.name,
        projectDescription: project?.description,
        active: "endpoints",
        endpointSearch: endpointSearchParams,
        groups,
        contracts,
        selectedGroup: groupFilter,
        onSelectGroup: (group) => updateEndpointSearch({ group }),
        onCreateGroup: () => setCreateGroupOpen(true),
        onMoveContractGroup: moveContractToGroup,
        onOpenContract: openContractTab,
        isMovingContract,
        totalCount: contracts.length,
        groupCounts,
        ungroupedCount,
        activeContractId: (() => {
          const active = openTabs.find((t) => t.id === activeTabId)
          return active?.kind === "contract" ? active.contractId : undefined
        })(),
      }}
    >
      <div className="min-h-[calc(100vh-3rem)] flex flex-col">
          {/* Top toolbar */}
          <div className="flex items-center gap-0 border-b border-border-subtle bg-surface">
            {/* Section switcher */}
            <Link
              to="/projects/$projectId/endpoints"
              params={{ projectId }}
              search={endpointSearchParams}
              className={[
                "relative flex items-center gap-1.5 px-5 py-3 font-mono text-xs font-medium transition-colors",
                activeSection === "endpoints"
                  ? "text-text-primary"
                  : "text-text-muted hover:text-text-secondary",
              ].join(" ")}
            >
              Endpoints
              {contracts.length > 0 && (
                <span className="tabular-nums text-[10px] text-text-muted">{contracts.length}</span>
              )}
              {activeSection === "endpoints" && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent" />
              )}
            </Link>
            <Link
              to="/projects/$projectId/preview"
              params={{ projectId }}
              className={[
                "relative flex items-center gap-1.5 px-5 py-3 font-mono text-xs font-medium transition-colors",
                activeSection === "preview"
                  ? "text-text-primary"
                  : "text-text-muted hover:text-text-secondary",
              ].join(" ")}
            >
              <Eye size={11} />
              Preview
              {activeSection === "preview" && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent" />
              )}
            </Link>
          </div>

          {/* Content */}
          {activeSection === "endpoints" ? (
            <div className="flex flex-col flex-1 min-h-0">
              {/* Postman-style tab bar */}
              <TabBar
                tabs={openTabs}
                activeTabId={activeTabId}
                onSelect={setActiveTabId}
                onClose={closeTab}
                onNew={openBlankTab}
              />

              {/* Tab content area */}
              {activeTabId === null ? (
                /* No tabs open — welcome state */
                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center py-20">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-default bg-elevated">
                    <FileSliders size={16} className="text-text-muted" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">Open an endpoint to get started</p>
                    <p className="mt-1 text-xs text-text-muted">
                      Select an endpoint from the sidebar, or click{" "}
                      <button
                        type="button"
                        onClick={openBlankTab}
                        className="text-accent hover:underline"
                      >
                        +
                      </button>{" "}
                      to open a new blank tab
                    </p>
                  </div>
                </div>
              ) : (() => {
                const activeTab = openTabs.find((t) => t.id === activeTabId)
                if (!activeTab) return null

                if (activeTab.kind === "blank") {
                  return (
                    <BlankTab
                      key={activeTab.id}
                      projectId={projectId}
                      onCreated={(contractId, method, path) => {
                        // Replace the blank tab with a contract tab in-place
                        const newTab: RequestTab = {
                          kind: "contract",
                          id: contractId,
                          contractId,
                          label: path,
                          method,
                        }
                        setOpenTabs((prev) =>
                          prev.map((t) => t.id === activeTab.id ? newTab : t)
                        )
                        setActiveTabId(contractId)
                      }}
                    />
                  )
                }

                return (
                  <ContractTabContent
                    key={activeTab.contractId}
                    contractId={activeTab.contractId}
                    projectId={projectId}
                    onDeleted={() => closeTab(activeTab.id)}
                  />
                )
              })()}
            </div>
          ) : (
            /* Preview section */
            <div className="flex-1 p-5">
              <SwaggerProjectPreview contracts={contracts} groups={groups} />
            </div>
          )}
      </div>

      {/* Dialogs */}
      <Dialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
        <NewGroupDialog
          key={createGroupOpen ? "open" : "closed"}
          projectId={projectId}
          onClose={() => setCreateGroupOpen(false)}
        />
      </Dialog>

      {deleteGroupTarget && (
        <DeleteGroupDialog
          projectId={projectId}
          group={deleteGroupTarget}
          onClose={() => setDeleteGroupTarget(null)}
        />
      )}
      {renameGroupTarget && (
        <RenameGroupDialog
          projectId={projectId}
          group={renameGroupTarget}
          onClose={() => setRenameGroupTarget(null)}
        />
      )}
    </AppLayout>
  )
}

// ─── Tab content components ───────────────────────────────────────────────────

function ContractTabContent({
  contractId,
  projectId,
  onDeleted,
}: {
  contractId: string
  projectId: string
  onDeleted: () => void
}) {
  const { data: contract, isLoading, isError } = useContract(projectId, contractId)

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="h-4 w-48 rounded bg-elevated animate-pulse" />
        <div className="h-3 w-32 rounded bg-elevated animate-pulse" />
      </div>
    )
  }

  if (isError || !contract) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 py-20 text-sm text-text-secondary">
        <AlertTriangle size={14} className="text-error shrink-0" />
        Could not load endpoint. Please close this tab and try again.
      </div>
    )
  }

  return (
    <ContractEditor
      contract={contract}
      projectId={projectId}
      onDeleted={onDeleted}
    />
  )
}

// ─── Schema helpers (mirrors contract-editor.tsx) ────────────────────────────

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
    const fieldPath = field.name.trim()
    if (!fieldPath) continue
    const segments = fieldPath.split(".")
    if (segments.some((s) => !s)) return invalid(`${label}: "${fieldPath}" is not a valid path.`, [i])
    if (seen.has(fieldPath)) {
      const existingIndex = pathIndexes.get(fieldPath)
      return invalid(`${label}: duplicate field "${fieldPath}".`, existingIndex === undefined ? [i] : [existingIndex, i])
    }

    for (let depth = 1; depth < segments.length; depth += 1) {
      const parentPath = segments.slice(0, depth).join(".")
      const parentType = fieldTypes.get(parentPath)
      if (parentType && parentType !== "object") {
        const parentIndex = pathIndexes.get(parentPath)
        return invalid(
          `${label}: "${parentPath}" must be type "object" before adding nested field "${fieldPath}".`,
          parentIndex === undefined ? [i] : [parentIndex, i]
        )
      }
    }

    for (const [existingPath, existingType] of fieldTypes) {
      if (existingPath.startsWith(`${fieldPath}.`) && field.type !== "object") {
        const childIndex = pathIndexes.get(existingPath)
        return invalid(
          `${label}: "${fieldPath}" must be type "object" because it already has nested fields.`,
          childIndex === undefined ? [i] : [i, childIndex]
        )
      }

      if (fieldPath.startsWith(`${existingPath}.`) && existingType !== "object") {
        const parentIndex = pathIndexes.get(existingPath)
        return invalid(
          `${label}: "${existingPath}" must be type "object" before adding nested field "${fieldPath}".`,
          parentIndex === undefined ? [i] : [parentIndex, i]
        )
      }
    }

    seen.add(fieldPath)
    fieldTypes.set(fieldPath, field.type)
    pathIndexes.set(fieldPath, i)
  }
  return { error: null, invalidRowIndexes: [] }
}

// ─── BlankTab ─────────────────────────────────────────────────────────────────

function BlankTab({
  projectId,
  onCreated,
}: {
  projectId: string
  onCreated: (contractId: string, method: HttpMethod, path: string) => void
}) {
  const [method, setMethod] = React.useState<HttpMethod>("GET")
  const [path, setPath] = React.useState("")
  const [groupId, setGroupId] = React.useState<string>("")
  const [activeTab, setActiveTab] = React.useState<"query" | "parameters" | "headers" | "auth" | "body" | "response" | "preview">("query")
  const [querySchema, setQuerySchema] = React.useState<ContractSchema>({ fields: [] })
  const [parametersSchema, setParametersSchema] = React.useState<ContractSchema>({ fields: [] })
  const [headersSchema, setHeadersSchema] = React.useState<ContractSchema>({ fields: [] })
  const [authSchema, setAuthSchema] = React.useState<ContractSchema>({ fields: [] })
  const [requestBodyFormat, setRequestBodyFormat] = React.useState<RequestBodyFormat>("json")
  const [requestSchema, setRequestSchema] = React.useState<ContractSchema>({ fields: [] })
  const [responseSchema, setResponseSchema] = React.useState<ContractSchema>({ fields: [] })
  const [queryPreviewMode, setQueryPreviewMode] = React.useState<"typescript" | "jsonc">("typescript")
  const [requestPreviewMode, setRequestPreviewMode] = React.useState<"typescript" | "jsonc">("typescript")
  const [responsePreviewMode, setResponsePreviewMode] = React.useState<"typescript" | "jsonc">("typescript")

  const { data: groups = [] } = useContractGroups(projectId)
  const { mutate: create, isPending } = useCreateContract(projectId)
  const { toast } = useToast()

  const trimmedPath = path.trim()

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

  function handleSave() {
    if (!trimmedPath) {
      toast({ title: "Path cannot be empty", variant: "error" })
      return
    }
    const normQuery = normalizeSchema(querySchema)
    const normParams = normalizeSchema(parametersSchema)
    const normHeaders = normalizeSchema(headersSchema)
    const normAuth = normalizeSchema(authSchema)
    const normReq = normalizeSchema(requestSchema)
    const normRes = normalizeSchema(responseSchema)

    const queryErr = validateSchema(normQuery, "Query").error
    if (queryErr) { toast({ title: "Invalid schema", description: queryErr, variant: "error" }); return }
    const paramsErr = validateSchema(normParams, "Parameters").error
    if (paramsErr) { toast({ title: "Invalid schema", description: paramsErr, variant: "error" }); return }
    const headersErr = validateSchema(normHeaders, "Headers").error
    if (headersErr) { toast({ title: "Invalid schema", description: headersErr, variant: "error" }); return }
    const authErr = validateSchema(normAuth, "Authorization").error
    if (authErr) { toast({ title: "Invalid schema", description: authErr, variant: "error" }); return }
    const reqErr = validateSchema(normReq, "Request Body").error
    if (reqErr) { toast({ title: "Invalid schema", description: reqErr, variant: "error" }); return }
    const resErr = validateSchema(normRes, "Response").error
    if (resErr) { toast({ title: "Invalid schema", description: resErr, variant: "error" }); return }

    create(
      {
        method,
        path: trimmedPath,
        groupId: groupId || null,
        querySchema: normQuery,
        parametersSchema: normParams,
        headersSchema: normHeaders,
        authSchema: normAuth,
        requestBodyFormat,
        requestSchema: normReq,
        responseSchema: normRes,
      },
      {
        onSuccess: (contract) => {
          toast({ title: "Endpoint created", variant: "success" })
          onCreated(contract.id, method, trimmedPath)
        },
        onError: (err) =>
          toast({ title: "Could not create endpoint", description: err.message, variant: "error" }),
      }
    )
  }

  const queryCount = querySchema.fields.filter((f) => f.name.trim()).length
  const parametersCount = parametersSchema.fields.filter((f) => f.name.trim()).length
  const headersCount = headersSchema.fields.filter((f) => f.name.trim()).length
  const authCount = authSchema.fields.filter((f) => f.name.trim()).length
  const requestCount = requestSchema.fields.filter((f) => f.name.trim()).length
  const responseCount = responseSchema.fields.filter((f) => f.name.trim()).length

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-y-auto">
      {/* ── Action bar (mirrors ContractEditor's action bar) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-surface px-5 py-2.5 font-mono">
        {/* Left: status badge */}
        <Badge variant="draft">new</Badge>

        {/* Right: group selector + preview toggle + save */}
        <div className="flex items-center gap-1.5">
          {groups.length > 0 && (
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="h-8 rounded border border-border-default bg-elevated px-2.5 font-mono text-xs text-text-secondary focus:border-accent focus:outline-none"
            >
              <option value="">No group</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          )}
          {/* Preview toggle */}
          <Button
            variant="ghost"
            size="icon"
            title="Preview"
            onClick={() => setActiveTab(activeTab === "preview" ? "query" : "preview")}
            className={activeTab === "preview" ? "text-accent bg-accent/10" : ""}
          >
            <Eye size={13} />
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!trimmedPath || isPending}
          >
            <Plus size={12} />
            {isPending ? "Saving..." : "Save endpoint"}
          </Button>
        </div>
      </div>

      {/* ── Schema tabs ── */}
      <div className="flex-1 px-5 py-4 space-y-4">
        {/* Method + Path bar (mirrors ContractEditor's Definition section) */}
        <section className="overflow-hidden rounded-md border border-border-subtle bg-surface font-mono shadow-brutal-sm">
          <div className="border-b border-border-subtle bg-elevated px-4 py-3">
            <div className="flex flex-wrap items-stretch gap-2">
              <div className={["flex h-10 min-w-20 items-center justify-center rounded-sm", METHOD_COLORS[method]].join(" ")}>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as HttpMethod)}
                  className={["h-10 min-w-20 rounded-sm bg-transparent px-3 text-center font-mono text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors focus:outline-none", METHOD_COLORS[method]].join(" ")}
                >
                  {HTTP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <input
                type="text"
                placeholder="/api/endpoint"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleSave() }}
                className="flex min-h-10 min-w-[220px] flex-1 rounded-sm border border-border-subtle bg-base px-3 font-mono text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* Tab strip — hidden when preview is active */}
        {activeTab !== "preview" && (
          <div className="flex items-center gap-0 border-b border-border-subtle">
            {(
              [
                { key: "query",      label: "Query",         count: queryCount },
                { key: "parameters", label: "Parameters",    count: parametersCount },
                { key: "headers",    label: "Headers",       count: headersCount },
                { key: "auth",       label: "Authorization", count: authCount },
                { key: "body",       label: "Body",          count: requestCount },
                { key: "response",   label: "Response",      count: responseCount },
              ] as const
            ).map(({ key, label, count }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={[
                  "relative px-4 py-2 font-mono text-xs font-medium transition-colors",
                  activeTab === key
                    ? "text-text-primary"
                    : "text-text-muted hover:text-text-secondary",
                ].join(" ")}
              >
                {label}
                {count > 0 && (
                  <span className="ml-1.5 tabular-nums text-[10px] text-text-muted">{count}</span>
                )}
                {activeTab === key && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Query tab */}
        {activeTab === "query" && (
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

        {/* Parameters tab */}
        {activeTab === "parameters" && (
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

        {/* Headers tab */}
        {activeTab === "headers" && (
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

        {/* Authorization tab */}
        {activeTab === "auth" && (
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

        {/* Body tab */}
        {activeTab === "body" && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)] xl:items-start">
            <div className="space-y-3">
              <section className="overflow-hidden rounded-md border border-border-subtle bg-surface font-mono shadow-brutal-sm">
                <div className="border-b border-border-subtle bg-elevated px-3 py-2">
                  <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">Body Format</span>
                </div>
                <div className="flex gap-2 p-3">
                  {(["json", "form-data"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setRequestBodyFormat(fmt)}
                      className={[
                        "rounded-md border px-3 py-1.5 font-mono text-xs uppercase tracking-[0.12em] transition-colors",
                        requestBodyFormat === fmt
                          ? "border-accent/30 bg-accent/12 text-accent"
                          : "border-border-subtle text-text-muted hover:border-border-default hover:text-text-primary",
                      ].join(" ")}
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

        {/* Response tab */}
        {activeTab === "response" && (
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

        {/* Preview tab */}
        {activeTab === "preview" && (
          <JsonPreview
            querySchema={querySchema}
            requestBodyFormat={requestBodyFormat}
            requestSchema={requestSchema}
            responseSchema={responseSchema}
            method={method}
            path={path}
          />
        )}
      </div>
    </div>
  )
}

// ─── Dialogs ──────────────────────────────────────────────────────────────────

const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"]

function NewGroupDialog({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [name, setName] = React.useState("")
  const { mutate: createGroup, isPending } = useCreateContractGroup(projectId)
  const { toast } = useToast()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    createGroup(
      { name: trimmed },
      {
        onSuccess: () => { toast({ title: "Group created", variant: "success" }); onClose() },
        onError: (err) => toast({ title: "Error", description: err.message, variant: "error" }),
      }
    )
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New group</DialogTitle></DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input label="Group name" placeholder="Authentication" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" disabled={isPending || !name.trim()}>
            {isPending ? "Creating..." : "Create"}
          </Button>
        </div>
      </form>
    </DialogContent>
  )
}

function RenameGroupDialog({ projectId, group, onClose }: { projectId: string; group: ContractGroup; onClose: () => void }) {
  const [name, setName] = React.useState(group.name)
  const { mutate: updateGroup, isPending } = useUpdateContractGroup(projectId)
  const { toast } = useToast()
  const trimmed = name.trim()
  const unchanged = trimmed === group.name

  React.useEffect(() => { setName(group.name) }, [group])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!trimmed || unchanged) return
    updateGroup(
      { groupId: group.id, data: { name: trimmed } },
      {
        onSuccess: () => { toast({ title: "Group renamed", variant: "success" }); onClose() },
        onError: (err) => toast({ title: "Error", description: err.message, variant: "error" }),
      }
    )
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Rename group</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input label="Group name" value={name} onChange={(e) => setName(e.target.value)} placeholder={group.name} autoFocus />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={isPending || !trimmed || unchanged}>
              {isPending ? "Saving..." : "Rename"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteGroupDialog({ projectId, group, onClose }: { projectId: string; group: ContractGroup; onClose: () => void }) {
  const [confirm, setConfirm] = React.useState("")
  const { mutate: deleteGroup, isPending } = useDeleteContractGroup(projectId)
  const { toast } = useToast()
  const confirmed = confirm.trim() === group.name

  function handleDelete() {
    if (!confirmed) return
    deleteGroup(
      { groupId: group.id, confirmName: confirm.trim() },
      {
        onSuccess: (r) => { toast({ title: "Group deleted", description: `${r.deletedEndpointCount} endpoint(s) removed.`, variant: "success" }); onClose() },
        onError: (err) => toast({ title: "Error", description: err.message, variant: "error" }),
      }
    )
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Delete group</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            This will delete <span className="font-medium text-text-primary">{group.name}</span> and all its endpoints. This cannot be undone.
          </p>
          <Input label={`Type "${group.name}" to confirm`} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={group.name} autoFocus />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={!confirmed || isPending}>
              {isPending ? "Deleting..." : "Delete group"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}




