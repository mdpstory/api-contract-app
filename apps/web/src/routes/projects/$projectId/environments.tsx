import { createFileRoute, redirect } from "@tanstack/react-router"
import * as React from "react"
import { Globe, Plus, MoreHorizontal, Pencil, Trash2, Box, AlertTriangle } from "lucide-react"
import { getOrFetchMe } from "@/features/auth/hooks"
import { useProject } from "@/features/projects/hooks"
import {
  useEnvironments,
  useCreateEnvironment,
  useUpdateEnvironment,
  useDeleteEnvironment,
} from "@/features/environments/hooks"
import { AppLayout } from "@/components/layout/app-layout"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useToast } from "@/lib/toast"
import type { Environment } from "@repo/types"

export const Route = createFileRoute("/projects/$projectId/environments")({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await getOrFetchMe(queryClient)
    if (!user) throw redirect({ to: "/auth/login" })
  },
  component: EnvironmentsPage,
})

interface EnvVar {
  key: string
  value: string
}

function EnvironmentsPage() {
  const { projectId } = Route.useParams()
  const { data: project } = useProject(projectId)
  const { data: environments = [], isLoading, isError } = useEnvironments(projectId)
  const [editTarget, setEditTarget] = React.useState<Environment | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<Environment | null>(null)

  const { mutate: deleteEnv, isPending: isDeletingEnvironment } =
    useDeleteEnvironment(projectId)
  const { toast } = useToast()

  function handleDeleteEnvironment() {
    if (!deleteTarget) return

    deleteEnv(deleteTarget.id, {
      onSuccess: () => toast({ title: "Environment deleted" }),
      onSettled: () => setDeleteTarget(null),
      onError: (err) =>
        toast({ title: "Error", description: err.message, variant: "error" }),
    })
  }

  return (
    <AppLayout
      mainClassName="p-0"
      sidebar={{
        kind: "project",
        projectId,
        projectName: project?.name,
        projectDescription: project?.description,
        active: "environments",
      }}
        breadcrumbs={[
          { label: "Projects", href: "/dashboard" },
          { label: project?.name ?? "...", href: `/projects/${projectId}/endpoints` },
          { label: "Environments" },
        ]}
    >
      <div className="min-h-[calc(100vh-3rem)] min-w-0 max-w-3xl space-y-8 p-5 sm:p-7 lg:p-10">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
                Environments
              </h1>
              <p className="text-sm text-text-secondary">
                Manage variables used across your contracts
              </p>
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus size={14} />
              New
            </Button>
          </div>

          {/* Env list */}
          {isLoading ? (
            <EnvListSkeleton />
          ) : isError ? (
            <div className="flex items-center gap-2 rounded-lg border border-border-subtle px-4 py-6 text-sm text-text-secondary justify-center">
              <AlertTriangle size={15} className="text-error shrink-0" />
              Could not load environments. Please refresh.
            </div>
          ) : environments.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border-default bg-surface/40 py-20 text-center shadow-brutal-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-md border border-border-subtle bg-elevated shadow-brutal-sm">
                <Box size={18} className="text-text-muted" />
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight text-text-primary">No environments yet</p>
                <p className="mt-1 text-sm text-text-secondary">
                  Create environments to manage variables like{" "}
                  <code className="font-mono bg-surface px-1 py-0.5 rounded">{"{{BASE_URL}}"}</code>
                </p>
              </div>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus size={14} />
                New Environment
              </Button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border-subtle divide-y divide-border-subtle bg-surface shadow-brutal-sm">
              {environments.map((env) => (
                <EnvRow
                  key={env.id}
                  env={env}
                  onEdit={() => setEditTarget(env)}
                  onDelete={() => setDeleteTarget(env)}
                />
              ))}
            </div>
          )}

          {/* Hint */}
          <p className="text-xs text-text-muted">
            Use variables in contracts with{" "}
            <code className="font-mono bg-surface px-1 py-0.5 rounded">
              {"{{variableName}}"}
            </code>
          </p>
      </div>

      {/* Create dialog */}
      <EnvironmentDialog
        projectId={projectId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      {/* Edit dialog */}
      {editTarget && (
        <EnvironmentDialog
          projectId={projectId}
          environment={editTarget}
          open
          onClose={() => setEditTarget(null)}
        />
      )}

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Environment</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Delete environment{" "}
              <span className="font-semibold text-text-primary">
                {deleteTarget?.name ?? "..."}
              </span>
              ? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteEnvironment}
                disabled={!deleteTarget || isDeletingEnvironment}
              >
                {isDeletingEnvironment ? "Deleting..." : "Delete Environment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

// ─── Env Row ──────────────────────────────────────────────────────────────────

function EnvRow({
  env,
  onEdit,
  onDelete,
}: {
  env: Environment
  onEdit: () => void
  onDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = React.useState(false)

  return (
    <div className="group flex items-center gap-3 bg-surface px-4 py-3.5 transition-colors hover:bg-overlay/35">
      {/* Icon */}
      {env.isGlobal ? (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-elevated">
          <Globe size={15} className="text-text-secondary shrink-0" />
        </div>
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-elevated">
          <Box size={15} className="text-text-muted shrink-0" />
        </div>
      )}

      {/* Name + var count */}
      <div className="flex-1 min-w-0">
        <span className="text-sm text-text-primary font-medium">
          {env.name}
        </span>
        <span className="ml-2 text-xs text-text-muted">
          {env.variables.length}{" "}
          {env.variables.length === 1 ? "variable" : "variables"}
        </span>
      </div>

      {/* Actions */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="p-1 rounded text-text-muted hover:text-text-primary transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <MoreHorizontal size={15} />
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-9 z-20 w-36 rounded-md border border-border-subtle bg-surface p-1 text-sm shadow-brutal-sm">
              <button
                onClick={() => { setMenuOpen(false); onEdit() }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-text-secondary transition-colors hover:bg-overlay hover:text-text-primary"
              >
                <Pencil size={12} />
                Edit
              </button>
              {!env.isGlobal && (
                <button
                  onClick={() => { setMenuOpen(false); onDelete() }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-error transition-colors hover:bg-error/10"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Environment Dialog ───────────────────────────────────────────────────────

function EnvironmentDialog({
  projectId,
  environment,
  open,
  onClose,
}: {
  projectId: string
  environment?: Environment
  open: boolean
  onClose: () => void
}) {
  const isEdit = !!environment
  const [name, setName] = React.useState(environment?.name ?? "")
  const [vars, setVars] = React.useState<EnvVar[]>(
    environment?.variables.length
      ? environment.variables.map((v) => ({ key: v.key, value: v.value }))
      : []
  )

  const { mutate: create, isPending: isCreating } = useCreateEnvironment(projectId)
  const { mutate: update, isPending: isUpdating } = useUpdateEnvironment(
    projectId,
    environment?.id ?? ""
  )
  const isPending = isCreating || isUpdating
  const { toast } = useToast()

  // Reset when dialog opens/closes
  React.useEffect(() => {
    if (open) {
      setName(environment?.name ?? "")
      setVars(
        environment?.variables.length
          ? environment.variables.map((v) => ({ key: v.key, value: v.value }))
          : []
      )
    }
  }, [open, environment])

  function addVar() {
    setVars((v) => [...v, { key: "", value: "" }])
  }

  function updateVar(i: number, field: keyof EnvVar, val: string) {
    setVars((v) => v.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)))
  }

  function removeVar(i: number) {
    setVars((v) => v.filter((_, idx) => idx !== i))
  }

  function handleSave() {
    const filteredVars = vars.filter((v) => v.key.trim())

    if (isEdit && environment) {
      update(
        {
          ...(environment.isGlobal ? {} : { name }),
          variables: filteredVars,
        },
        {
          onSuccess: () => {
            toast({ title: "Environment updated", variant: "success" })
            onClose()
          },
          onError: (err) =>
            toast({ title: "Error", description: err.message, variant: "error" }),
        }
      )
    } else {
      create(
        { name, variables: filteredVars },
        {
          onSuccess: () => {
            toast({ title: "Environment created", variant: "success" })
            onClose()
          },
          onError: (err) =>
            toast({ title: "Error", description: err.message, variant: "error" }),
        }
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Environment" : "New Environment"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Label */}
          {(!isEdit || !environment?.isGlobal) && (
            <Input
              label="Label"
              placeholder="Staging"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus={!isEdit}
            />
          )}

          {/* Variables */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium tracking-wide text-text-secondary">
                  Variables
                </span>
                <button
                  type="button"
                  onClick={addVar}
                  className="text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
                >
                  + Add new
                </button>
            </div>

            {vars.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border-default bg-surface/40 py-10">
                {/* Decorative icon */}
                <div className="flex h-12 w-12 items-center justify-center rounded-md border border-border-subtle bg-elevated shadow-brutal-sm">
                  <Box size={18} className="text-text-muted" />
                </div>
                <p className="text-xs text-text-muted">Environments are empty</p>
                <button
                  type="button"
                  onClick={addVar}
                  className="flex items-center gap-1 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
                >
                  <Plus size={11} />
                  Add new
                </button>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {vars.map((v, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      placeholder="KEY"
                      value={v.key}
                      onChange={(e) => updateVar(i, "key", e.target.value)}
                      className="h-9 flex-1 rounded-lg border border-border-subtle bg-elevated px-3 font-mono text-xs text-text-primary placeholder:text-text-muted transition-colors focus:border-border-default focus:outline-none"
                    />
                    <input
                      placeholder="value"
                      value={v.value}
                      onChange={(e) => updateVar(i, "value", e.target.value)}
                      className="h-9 flex-[2] rounded-lg border border-border-subtle bg-elevated px-3 text-xs text-text-primary placeholder:text-text-muted transition-colors focus:border-border-default focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeVar(i)}
                      className="rounded-md p-2 text-text-muted transition-colors hover:bg-overlay hover:text-error"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isPending || (!isEdit && !name)}
            >
              {isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function EnvListSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle divide-y divide-border-subtle bg-surface shadow-brutal-sm">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 bg-surface">
          <div className="h-4 w-4 rounded bg-overlay animate-pulse" />
          <div className="h-4 w-32 rounded bg-overlay animate-pulse" />
        </div>
      ))}
    </div>
  )
}
