import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useSearch,
} from "@tanstack/react-router"
import * as React from "react"
import {
  Plus,
  AlertTriangle,
  Folder,
  GripVertical,
  Pencil,
  Trash2,
  Eye,
  Search,
} from "lucide-react"
import { useProject } from "@/features/projects/hooks"
import {
  ALL_GROUP_FILTER,
  ProjectSidebar,
  type GroupFilter,
  UNGROUPED_GROUP_FILTER,
} from "@/features/projects/components/project-sidebar"
import {
  useContractGroups,
  useContracts,
  useCreateContract,
  useCreateContractGroup,
  useDeleteContract,
  useDeleteContractGroup,
  useMoveContractGroup,
  useUpdateContractGroup,
} from "@/features/contracts/hooks"
import { AppLayout } from "@/components/layout/app-layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SwaggerProjectPreview } from "@/features/contracts/components/swagger-preview"
import { useToast } from "@/lib/toast"
import type { Contract, ContractGroup, HttpMethod } from "@repo/types"

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
type ProjectHomeTab = "endpoints" | "preview-all"
const UNGROUPED_DROP_TARGET = UNGROUPED_GROUP_FILTER

function ProjectLayout() {
  return <Outlet />
}

export function ProjectHomePage({ projectId }: { projectId: string }) {
  const navigate = useNavigate()
  const searchState = useSearch({ from: "/projects/$projectId/" })
  const { data: project } = useProject(projectId)
  const { data: contracts = [], isLoading, isError } = useContracts(projectId)
  const {
    data: groups = [],
    isLoading: isGroupsLoading,
    isError: isGroupsError,
  } = useContractGroups(projectId)

  const [createEndpointOpen, setCreateEndpointOpen] = React.useState(false)
  const [createGroupOpen, setCreateGroupOpen] = React.useState(false)
  const [renameGroupTarget, setRenameGroupTarget] = React.useState<ContractGroup | null>(null)
  const [deleteGroupTarget, setDeleteGroupTarget] = React.useState<ContractGroup | null>(null)
  const [draggingContractId, setDraggingContractId] = React.useState<string | null>(null)
  const [dragOverTarget, setDragOverTarget] = React.useState<string | null>(null)

  const { mutate: moveContractGroup, isPending: isMovingContract } = useMoveContractGroup(projectId)
  const { toast } = useToast()

  const activeTab = (searchState.tab ?? "endpoints") as ProjectHomeTab
  const filter    = (searchState.filter ?? "all") as FilterStatus
  const search    = searchState.q ?? ""
  const groupFilter = ((searchState.group as GroupFilter | undefined) ?? ALL_GROUP_FILTER) as GroupFilter

  function updateSearch(
    patch: Partial<{ tab: ProjectHomeTab; filter: FilterStatus; q: string; group: string }>
  ) {
    void navigate({
      to: "/projects/$projectId",
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
    if (groupFilter === ALL_GROUP_FILTER || groupFilter === UNGROUPED_DROP_TARGET) return
    if (!groups.some((g) => g.id === groupFilter)) updateSearch({ group: ALL_GROUP_FILTER })
  }, [groupFilter, groups])

  const statusFiltered = contracts.filter((c) => {
    const q = search.toLowerCase()
    const matchStatus = filter === "all" || c.status === filter
    const matchSearch = !search || c.path.toLowerCase().includes(q) || c.method.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const filtered = statusFiltered.filter((c) => {
    if (groupFilter === ALL_GROUP_FILTER) return true
    if (groupFilter === UNGROUPED_DROP_TARGET) return !c.groupId || !groupById.has(c.groupId)
    return c.groupId === groupFilter
  })

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
  const isDraggingContract = draggingContractId !== null
  const showEmptyGroups = !search && filter === "all" && groupFilter === ALL_GROUP_FILTER

  const visibleGroups =
    groupFilter === ALL_GROUP_FILTER
      ? groups
      : groupFilter === UNGROUPED_DROP_TARGET
        ? []
        : groups.filter((g) => g.id === groupFilter)

  const groupedSections = visibleGroups
    .map((group) => ({
      group,
      items: filtered.filter((c) => c.groupId === group.id),
    }))
    .filter((s) =>
      groupFilter !== ALL_GROUP_FILTER
        ? true
        : s.items.length > 0 || showEmptyGroups || isDraggingContract
    )

  const ungroupedContracts = filtered.filter((c) => !c.groupId || !groupById.has(c.groupId))
  const isShowingUngrouped = groupFilter === ALL_GROUP_FILTER || groupFilter === UNGROUPED_DROP_TARGET
  const showUngroupedSection =
    isShowingUngrouped &&
    (ungroupedContracts.length > 0 || groups.length === 0 || isDraggingContract || groupFilter === UNGROUPED_DROP_TARGET)

  function clearDragState() {
    setDraggingContractId(null)
    setDragOverTarget(null)
  }

  function handleContractDragStart(contractId: string, event: React.DragEvent<HTMLButtonElement>) {
    if (isMovingContract) return
    setDraggingContractId(contractId)
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("application/x-contract-id", contractId)
    event.dataTransfer.setData("text/plain", contractId)
  }

  function handleDropZoneDragOver(target: string, event: React.DragEvent<HTMLDivElement>) {
    if (!draggingContractId || isMovingContract) return
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    if (dragOverTarget !== target) setDragOverTarget(target)
  }

  function handleDropOnTarget(target: string, event: React.DragEvent<HTMLDivElement>) {
    if (isMovingContract) return
    event.preventDefault()
    const draggedId =
      draggingContractId ||
      event.dataTransfer.getData("application/x-contract-id") ||
      event.dataTransfer.getData("text/plain")
    if (!draggedId) { clearDragState(); return }

    const draggedContract = contracts.find((c) => c.id === draggedId)
    if (!draggedContract) { clearDragState(); return }

    const nextGroupId = target === UNGROUPED_DROP_TARGET ? null : target
    if ((draggedContract.groupId ?? null) === nextGroupId) { clearDragState(); return }

    moveContractGroup(
      { contractId: draggedContract.id, groupId: nextGroupId },
      {
        onSuccess: () => {
          const targetName = nextGroupId === null ? "Ungrouped" : (groupById.get(nextGroupId)?.name ?? "Group")
          toast({ title: "Moved to " + targetName, variant: "success" })
        },
        onError: (err) => toast({ title: "Error", description: err.message, variant: "error" }),
      }
    )
    clearDragState()
  }

  const endpointSearchParams = { tab: activeTab, filter, q: search, group: groupFilter }

  return (
    <AppLayout
      mainClassName="p-0"
      breadcrumbs={[
        { label: "Projects", href: "/dashboard" },
        { label: project?.name ?? "..." },
      ]}
    >
      <div className="min-h-[calc(100vh-3rem)] grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)]">
        <ProjectSidebar
          projectId={projectId}
          active="endpoints"
          groups={groups}
          selectedGroup={groupFilter}
          onSelectGroup={(g) => updateSearch({ group: g })}
          onCreateGroup={() => setCreateGroupOpen(true)}
          totalCount={contracts.length}
          groupCounts={groupCounts}
          ungroupedCount={ungroupedCount}
        />

        <div className="min-w-0 flex flex-col">
          {/* Top toolbar */}
          <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-3">
            {/* Tab switcher */}
            <div className="flex items-center gap-1 bg-overlay rounded p-0.5">
              <button
                type="button"
                onClick={() => updateSearch({ tab: "endpoints" })}
                className={[
                  "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  activeTab === "endpoints"
                    ? "bg-elevated text-text-primary shadow-card"
                    : "text-text-muted hover:text-text-secondary",
                ].join(" ")}
              >
                Endpoints
                {contracts.length > 0 && (
                  <span className="text-[10px] text-text-muted tabular-nums">{contracts.length}</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => updateSearch({ tab: "preview-all" })}
                className={[
                  "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  activeTab === "preview-all"
                    ? "bg-elevated text-text-primary shadow-card"
                    : "text-text-muted hover:text-text-secondary",
                ].join(" ")}
              >
                <Eye size={11} />
                Preview
              </button>
            </div>

            {/* Actions */}
            {activeTab === "endpoints" && (
              <Button size="sm" onClick={() => setCreateEndpointOpen(true)}>
                <Plus size={12} />
                Add endpoint
              </Button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 p-5">
            {activeTab === "endpoints" && (
              <div className="space-y-4">
                {/* Filter + search row */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Status pills */}
                  <div className="flex items-center gap-0.5 rounded border border-border-subtle bg-elevated p-0.5">
                    {(["all", "draft", "approved"] as FilterStatus[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => updateSearch({ filter: f })}
                        className={[
                          "rounded px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
                          filter === f
                            ? "bg-surface text-text-primary shadow-card"
                            : "text-text-muted hover:text-text-secondary",
                        ].join(" ")}
                      >
                        {f}
                      </button>
                    ))}
                  </div>

                  {/* Search */}
                  <div className="relative flex-1 min-w-40">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search endpoints..."
                      value={search}
                      onChange={(e) => updateSearch({ q: e.target.value })}
                      className="h-8 w-full rounded border border-border-default bg-elevated pl-7 pr-3 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-accent focus:outline-none"
                    />
                  </div>

                  {search || filter !== "all" ? (
                    <span className="text-xs text-text-muted">
                      {filtered.length} of {contracts.length}
                    </span>
                  ) : null}
                </div>

                {/* Endpoint list */}
                {isLoading || isGroupsLoading ? (
                  <ContractListSkeleton />
                ) : isError || isGroupsError ? (
                  <ErrorState message="Could not load endpoints. Please refresh." />
                ) : filtered.length === 0 && contracts.length > 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-sm text-text-muted">No endpoints match your filter.</p>
                    <button
                      className="mt-2 text-xs text-accent hover:underline"
                      onClick={() => updateSearch({ filter: "all", q: "" })}
                    >
                      Clear filters
                    </button>
                  </div>
                ) : contracts.length === 0 && groups.length === 0 ? (
                  <EmptyState onNew={() => setCreateEndpointOpen(true)} />
                ) : (
                  <div className="space-y-3">
                    {groupedSections.map(({ group, items }) => (
                      <GroupSection
                        key={group.id}
                        group={group}
                        contracts={items}
                        projectId={projectId}
                        endpointSearch={endpointSearchParams}
                        isDropTarget={dragOverTarget === group.id}
                        onDragOver={(e) => handleDropZoneDragOver(group.id, e)}
                        onDrop={(e) => handleDropOnTarget(group.id, e)}
                        onContractDragStart={handleContractDragStart}
                        onContractDragEnd={clearDragState}
                        draggingContractId={draggingContractId}
                        onRenameGroup={() => setRenameGroupTarget(group)}
                        onDeleteGroup={() => setDeleteGroupTarget(group)}
                      />
                    ))}

                    {showUngroupedSection && (
                      <div
                        className={[
                          "overflow-hidden rounded-md border bg-surface transition-colors",
                          dragOverTarget === UNGROUPED_DROP_TARGET
                            ? "border-border-strong"
                            : "border-border-subtle",
                        ].join(" ")}
                        onDragOver={(e) => handleDropZoneDragOver(UNGROUPED_DROP_TARGET, e)}
                        onDrop={(e) => handleDropOnTarget(UNGROUPED_DROP_TARGET, e)}
                      >
                        <div className="flex items-center gap-2 border-b border-border-subtle bg-elevated/50 px-3 py-2">
                          <span className="text-xs font-medium text-text-muted">Ungrouped</span>
                          <span className="text-[10px] text-text-muted tabular-nums">
                            {ungroupedContracts.length}
                          </span>
                        </div>
                        {ungroupedContracts.length === 0 ? (
                          <p className="px-3 py-4 text-xs text-text-muted">Drop endpoints here.</p>
                        ) : (
                          ungroupedContracts.map((contract, i) => (
                            <ContractRow
                              key={contract.id}
                              contract={contract}
                              projectId={projectId}
                              endpointSearch={endpointSearchParams}
                              isLast={i === ungroupedContracts.length - 1}
                              isDragging={draggingContractId === contract.id}
                              onDragStart={handleContractDragStart}
                              onDragEnd={clearDragState}
                            />
                          ))
                        )}
                      </div>
                    )}

                    {groupedSections.length === 0 && groups.length > 0 && showEmptyGroups && (
                      <p className="text-sm text-text-muted text-center py-8">
                        No endpoints yet. Add an endpoint and assign it to a group.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === "preview-all" && (
              isLoading || isGroupsLoading ? (
                <ContractListSkeleton />
              ) : isError || isGroupsError ? (
                <ErrorState message="Could not load preview. Please refresh." />
              ) : (
                <SwaggerProjectPreview contracts={contracts} groups={groups} />
              )
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={createEndpointOpen} onOpenChange={setCreateEndpointOpen}>
        <NewContractDialog
          key={createEndpointOpen ? "open" : "closed"}
          projectId={projectId}
          groups={groups}
          onClose={() => setCreateEndpointOpen(false)}
        />
      </Dialog>

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

// ─── Group Section ─────────────────────────────────────────────────────────────

function GroupSection({
  group,
  contracts,
  projectId,
  endpointSearch,
  isDropTarget,
  onDragOver,
  onDrop,
  onContractDragStart,
  onContractDragEnd,
  draggingContractId,
  onRenameGroup,
  onDeleteGroup,
}: {
  group: ContractGroup
  contracts: Contract[]
  projectId: string
  endpointSearch: { tab: ProjectHomeTab; filter: FilterStatus; q: string; group: GroupFilter }
  isDropTarget: boolean
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void
  onContractDragStart: (id: string, e: React.DragEvent<HTMLButtonElement>) => void
  onContractDragEnd: () => void
  draggingContractId: string | null
  onRenameGroup: () => void
  onDeleteGroup: () => void
}) {
  return (
    <div
      className={[
        "overflow-hidden rounded-md border bg-surface transition-colors",
        isDropTarget ? "border-border-strong" : "border-border-subtle",
      ].join(" ")}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border-subtle bg-elevated/50 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <Folder size={12} className="text-text-muted shrink-0" />
          <span className="truncate text-xs font-medium text-text-primary">{group.name}</span>
          <span className="text-[10px] text-text-muted tabular-nums shrink-0">{contracts.length}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onRenameGroup}
            title="Rename"
            className="rounded p-1 text-text-muted transition-colors hover:bg-overlay hover:text-text-secondary"
          >
            <Pencil size={11} />
          </button>
          <button
            type="button"
            onClick={onDeleteGroup}
            title="Delete"
            className="rounded p-1 text-text-muted transition-colors hover:bg-overlay hover:text-error"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {contracts.length === 0 ? (
        <p className="px-3 py-4 text-xs text-text-muted">Drop endpoints here.</p>
      ) : (
        contracts.map((contract, i) => (
          <ContractRow
            key={contract.id}
            contract={contract}
            projectId={projectId}
            endpointSearch={endpointSearch}
            isLast={i === contracts.length - 1}
            isDragging={draggingContractId === contract.id}
            onDragStart={onContractDragStart}
            onDragEnd={onContractDragEnd}
          />
        ))
      )}
    </div>
  )
}

// ─── Contract Row ──────────────────────────────────────────────────────────────

function ContractRow({
  contract,
  projectId,
  endpointSearch,
  isLast,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  contract: Contract
  projectId: string
  endpointSearch: { tab: ProjectHomeTab; filter: FilterStatus; q: string; group: GroupFilter }
  isLast: boolean
  isDragging: boolean
  onDragStart: (id: string, e: React.DragEvent<HTMLButtonElement>) => void
  onDragEnd: () => void
}) {
  const { toast } = useToast()
  const { mutate: remove, isPending: isDeleting } = useDeleteContract(projectId)
  const [deleteOpen, setDeleteOpen] = React.useState(false)

  function handleDelete() {
    remove(contract.id, {
      onSuccess: () => {
        setDeleteOpen(false)
        toast({ title: "Endpoint deleted", variant: "success" })
      },
      onError: (err) => toast({ title: "Delete failed", description: err.message, variant: "error" }),
    })
  }

  return (
    <div
      className={[
        "group flex items-center gap-1.5 px-3 py-2.5 transition-colors hover:bg-overlay/40",
        isDragging ? "opacity-40" : "",
        !isLast ? "border-b border-border-subtle" : "",
      ].join(" ")}
    >
      {/* Drag handle */}
      <button
        type="button"
        draggable
        onDragStart={(e) => onDragStart(contract.id, e)}
        onDragEnd={onDragEnd}
        title="Drag to move"
        className="h-6 w-5 shrink-0 flex items-center justify-center rounded text-text-muted cursor-grab active:cursor-grabbing hover:text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <GripVertical size={11} />
      </button>

      {/* Main link */}
      <Link
        to="/projects/$projectId/contracts/$contractId"
        params={{ projectId, contractId: contract.id }}
        search={{
          listTab: endpointSearch.tab,
          listFilter: endpointSearch.filter,
          listQ: endpointSearch.q,
          listGroup: endpointSearch.group,
          tab: "definition",
          definitionTab: "request",
        }}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <span className={["shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold w-12 text-center", METHOD_COLORS[contract.method]].join(" ")}>
          {contract.method}
        </span>
        <span className="flex-1 truncate font-mono text-sm text-text-secondary group-hover:text-text-primary transition-colors">
          {contract.path}
        </span>
        <Badge variant={contract.status === "approved" ? "approved" : "draft"} className="shrink-0">
          {contract.status}
        </Badge>
      </Link>

      {/* Delete */}
      <button
        type="button"
        onClick={() => setDeleteOpen(true)}
        disabled={isDeleting}
        title="Delete"
        className="h-6 w-6 shrink-0 flex items-center justify-center rounded text-text-muted/80 transition-colors hover:bg-error/10 hover:text-error disabled:opacity-40"
      >
        <Trash2 size={11} />
      </button>

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
              <Button type="button" variant="ghost" size="sm" onClick={() => setDeleteOpen(false)} disabled={isDeleting}>
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

function NewContractDialog({ projectId, groups, onClose }: { projectId: string; groups: ContractGroup[]; onClose: () => void }) {
  const [method, setMethod] = React.useState<HttpMethod>("GET")
  const [path, setPath] = React.useState("")
  const [groupId, setGroupId] = React.useState("")
  const { mutate: create, isPending } = useCreateContract(projectId)
  const { toast } = useToast()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const p = path.trim()
    if (!p) return
    create(
      { method, path: p, groupId: groupId || null },
      {
        onSuccess: () => { toast({ title: "Endpoint created", variant: "success" }); onClose() },
        onError: (err) => toast({ title: "Error", description: err.message, variant: "error" }),
      }
    )
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Add endpoint</DialogTitle></DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-secondary">Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value as HttpMethod)} className={SELECT_CLS}>
              {HTTP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <Input label="Path" placeholder="/api/users" value={path} onChange={(e) => setPath(e.target.value)} required autoFocus />
          </div>
        </div>

        {groups.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-text-secondary">Group</label>
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={SELECT_CLS}>
              <option value="">No group</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" disabled={isPending || !path.trim()}>
            {isPending ? "Creating..." : "Add endpoint"}
          </Button>
        </div>
      </form>
    </DialogContent>
  )
}

// ─── Empty / Error / Skeleton ──────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border-default py-20 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-default bg-elevated">
        <span className="font-mono text-xs font-semibold text-text-muted">API</span>
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary">No endpoints yet</p>
        <p className="text-xs text-text-muted mt-1">Add your first endpoint to start defining the contract</p>
      </div>
      <Button size="sm" onClick={onNew}>
        <Plus size={12} />
        Add endpoint
      </Button>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <AlertTriangle size={16} className="text-error" />
      <p className="text-sm text-text-secondary">{message}</p>
    </div>
  )
}

function ContractListSkeleton() {
  return (
    <div className="overflow-hidden rounded-md border border-border-subtle">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={["flex items-center gap-3 px-3 py-2.5", i < 3 ? "border-b border-border-subtle" : ""].join(" ")}
        >
          <div className="h-4 w-12 rounded bg-overlay animate-pulse" />
          <div className="h-3 w-44 rounded bg-overlay animate-pulse" />
          <div className="ml-auto h-4 w-14 rounded bg-overlay animate-pulse" />
        </div>
      ))}
    </div>
  )
}
