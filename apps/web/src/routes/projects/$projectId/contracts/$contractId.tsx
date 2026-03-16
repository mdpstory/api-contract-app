import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router"
import * as React from "react"
import { AlertTriangle, ArrowLeft } from "lucide-react"
import { getOrFetchMe } from "@/features/auth/hooks"
import { useProject } from "@/features/projects/hooks"
import {
  useContract,
  useCreateContractGroup,
  useContractGroups,
  useContracts,
  useMoveContractGroup,
} from "@/features/contracts/hooks"
import { AppLayout } from "@/components/layout/app-layout"
import {
  Dialog,
} from "@/components/ui/dialog"
import { ContractEditor } from "@/features/contracts/components/contract-editor"
import { useToast } from "@/lib/toast"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Contract } from "@repo/types"

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

  return <ContractDetailView contract={contract} projectId={projectId} />
}

// ─── Full-page contract view (wraps ContractEditor in AppLayout) ──────────────

function ContractDetailView({ contract, projectId }: { contract: Contract; projectId: string }) {
  const navigate = useNavigate()
  const searchState = Route.useSearch()
  const { data: project } = useProject(projectId)
  const { data: contracts = [] } = useContracts(projectId)
  const { data: groups = [] } = useContractGroups(projectId)
  const { mutate: moveContractGroup, isPending: isMovingContract } =
    useMoveContractGroup(projectId)
  const { toast } = useToast()

  const [createGroupOpen, setCreateGroupOpen] = React.useState(false)

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

  const groupName = contract.groupId
    ? (groups.find((g) => g.id === contract.groupId)?.name ?? "Ungrouped")
    : "Ungrouped"

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
    >
      <div className="min-h-[calc(100vh-3rem)] min-w-0 flex flex-col">
        {/* Back navigation bar */}
        <div className="flex items-center gap-3 border-b border-border-subtle bg-surface px-5 py-2.5 font-mono">
          <Link
            {...backNavigation}
            className="flex shrink-0 items-center gap-1 text-xs text-text-muted transition-colors hover:text-text-secondary"
          >
            <ArrowLeft size={12} />
            Back
          </Link>
        </div>

        {/* Contract editor */}
        <ContractEditor
          contract={contract}
          projectId={projectId}
          onDeleted={() => void navigate(backNavigation)}
          initialTab={searchState.tab}
          initialDefinitionTab={searchState.definitionTab}
        />
      </div>

      <Dialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
        <CreateGroupDialogContent
          key={createGroupOpen ? "open" : "closed"}
          projectId={projectId}
          onClose={() => setCreateGroupOpen(false)}
        />
      </Dialog>
    </AppLayout>
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
