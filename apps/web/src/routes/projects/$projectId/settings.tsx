import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import * as React from "react"
import { UserMinus, AlertTriangle, Trash2 } from "lucide-react"
import { getOrFetchMe, useMe } from "@/features/auth/hooks"
import { ProjectSidebar } from "@/features/projects/components/project-sidebar"
import {
  useProject,
  useUpdateProject,
  useMembers,
  useInviteMember,
  useRemoveMember,
  useDeleteProject,
} from "@/features/projects/hooks"
import { AppLayout } from "@/components/layout/app-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/lib/toast"

export const Route = createFileRoute("/projects/$projectId/settings")({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await getOrFetchMe(queryClient)
    if (!user) throw redirect({ to: "/auth/login" })
  },
  component: ProjectSettingsPage,
})

function ProjectSettingsPage() {
  const { projectId } = Route.useParams()
  const navigate = useNavigate()
  const { data: project } = useProject(projectId)
  const { data: members = [], isLoading, isError } = useMembers(projectId)
  const { data: me } = useMe()
  const [email, setEmail] = React.useState("")
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [memberToRemove, setMemberToRemove] = React.useState<{
    userId: string
    email: string
  } | null>(null)
  const [confirmProjectName, setConfirmProjectName] = React.useState("")
  const [projectName, setProjectName] = React.useState(project?.name ?? "")
  const [projectDescription, setProjectDescription] = React.useState(project?.description ?? "")
  const { mutate: updateProject, isPending: isUpdatingProject } = useUpdateProject(projectId)
  const { mutate: invite, isPending } = useInviteMember(projectId)
  const { mutate: remove, isPending: isRemovingMember } = useRemoveMember(projectId)
  const { mutate: deleteProject, isPending: isDeletingProject } = useDeleteProject()
  const { toast } = useToast()
  const myMembership = members.find((member) => member.userId === me?.id)
  const canDeleteProject = myMembership?.role === "owner"
  const isOwner = myMembership?.role === "owner"
  const isDeleteConfirmed = confirmProjectName.trim() === (project?.name ?? "")

  // Sync project data when it loads
  React.useEffect(() => {
    if (project) {
      setProjectName(project.name)
      setProjectDescription(project.description ?? "")
    }
  }, [project])

  const isProjectInfoDirty =
    projectName.trim() !== (project?.name ?? "") ||
    projectDescription.trim() !== (project?.description ?? "")

  function handleUpdateProject(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = projectName.trim()
    if (!trimmedName) return

    updateProject(
      {
        name: trimmedName,
        description: projectDescription.trim() || undefined,
      },
      {
        onSuccess: () =>
          toast({ title: "Project updated", variant: "success" }),
        onError: (err) =>
          toast({ title: "Error", description: err.message, variant: "error" }),
      }
    )
  }

  function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    invite(email, {
      onSuccess: () => {
        toast({ title: "Member added", variant: "success" })
        setEmail("")
      },
      onError: (err) =>
        toast({ title: "Error", description: err.message, variant: "error" }),
    })
  }

  function handleRemoveMember() {
    if (!memberToRemove) return

    remove(memberToRemove.userId, {
      onSuccess: () => toast({ title: "Member removed" }),
      onSettled: () => setMemberToRemove(null),
      onError: (err) =>
        toast({ title: "Error", description: err.message, variant: "error" }),
    })
  }

  function closeDeleteDialog() {
    setDeleteOpen(false)
    setConfirmProjectName("")
  }

  function handleDeleteProject() {
    if (!project || !isDeleteConfirmed) return

    deleteProject(
      { id: projectId, confirmName: confirmProjectName.trim() },
      {
        onSuccess: async () => {
          closeDeleteDialog()
          toast({
            title: "Project deleted",
            description: `${project.name} was permanently removed.`,
            variant: "success",
          })
          await navigate({ to: "/dashboard" })
        },
        onError: (err) =>
          toast({ title: "Error", description: err.message, variant: "error" }),
      }
    )
  }

  return (
    <AppLayout
      mainClassName="p-0"
      breadcrumbs={[
        { label: "Projects", href: "/dashboard" },
        { label: project?.name ?? "...", href: `/projects/${projectId}` },
        { label: "Settings" },
      ]}
    >
      <div className="min-h-[calc(100vh-3rem)] grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)]">
        <ProjectSidebar projectId={projectId} active="settings" />

        <div className="min-w-0 max-w-2xl space-y-8 p-5 sm:p-7 lg:p-10">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">Settings</h1>
            <p className="text-sm text-text-secondary">
              Manage project details and members
            </p>
          </div>

          {/* Project info */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-text-primary">
              Project Details
            </h2>
            <form onSubmit={handleUpdateProject} className="space-y-4 rounded-lg border border-border-subtle bg-surface p-4 shadow-brutal-sm">
              <Input
                label="Name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                disabled={!isOwner}
                required
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                  Description
                  <span className="text-text-muted font-normal normal-case ml-1">(optional)</span>
                </label>
                <textarea
                  className="w-full rounded-md border border-border-default bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:outline-none focus:border-accent resize-none h-20 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Describe what this project is for..."
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  disabled={!isOwner}
                />
              </div>
              {isOwner && (
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isUpdatingProject || !isProjectInfoDirty || !projectName.trim()}
                  >
                    {isUpdatingProject ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              )}
              {!isOwner && (
                <p className="text-xs text-text-muted">
                  Only project owners can edit project details.
                </p>
              )}
            </form>
          </section>

          {/* Invite member */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-text-primary">
              Invite Member
            </h2>
            <form onSubmit={handleInvite} className="flex gap-2">
              <Input
                placeholder="colleague@company.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1"
              />
              <Button type="submit" disabled={isPending || !email}>
                {isPending ? "Adding..." : "Add"}
              </Button>
            </form>
            <p className="text-xs text-text-muted">
              The user must have signed in to API Contract at least once.
            </p>
          </section>

          {/* Member list */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-text-primary">Members</h2>

            {isLoading ? (
              <MemberListSkeleton />
            ) : isError ? (
              <div className="flex items-center gap-2 rounded-lg border border-border-subtle px-4 py-6 text-sm text-text-secondary justify-center">
                <AlertTriangle size={15} className="text-error shrink-0" />
                Could not load members. Please refresh.
              </div>
            ) : members.length === 0 ? (
              <p className="rounded-md border border-border-subtle bg-surface/50 py-8 text-sm text-text-muted">
                No members found.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border-subtle divide-y divide-border-subtle bg-surface shadow-brutal-sm">
                {members.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center gap-3 bg-surface px-4 py-3.5"
                  >
                    {/* Avatar placeholder */}
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-elevated">
                      <span className="text-xs font-semibold text-text-primary">
                        {(member.user.name ?? member.user.email)
                          .charAt(0)
                          .toUpperCase()}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      {member.user.name && (
                        <p className="text-sm text-text-primary font-medium truncate">
                          {member.user.name}
                        </p>
                      )}
                      <p className="text-xs text-text-secondary truncate">
                        {member.user.email}
                      </p>
                    </div>

                    <Badge variant={member.role === "owner" ? "accent" : "draft"}>
                      {member.role}
                    </Badge>

                    {member.role !== "owner" && member.userId !== me?.id && (
                        <button
                          onClick={() =>
                            setMemberToRemove({
                              userId: member.userId,
                              email: member.user.email,
                            })
                          }
                          className="rounded-md p-2 text-text-muted transition-colors hover:bg-overlay hover:text-error"
                          title="Remove member"
                        >
                        <UserMinus size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4 rounded-lg border border-error/30 bg-error/5 p-5 sm:p-6">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold tracking-wide text-error">
                Danger Zone
              </h2>
              <p className="text-sm text-text-secondary">
                Permanently delete this project, including its endpoints, groups,
                environments, and member access.
              </p>
            </div>

            <div className="flex flex-col gap-3 rounded-md border border-error/20 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-text-primary">Delete project</p>
                <p className="text-xs text-text-muted">
                  This action cannot be undone.
                </p>
              </div>

              <Button
                type="button"
                variant="destructive"
                onClick={() => setDeleteOpen(true)}
                disabled={!canDeleteProject || !project}
              >
                <Trash2 size={14} />
                Delete Project
              </Button>
            </div>

            {!canDeleteProject && (
              <p className="text-xs text-text-muted">
                Only project owners can delete this project.
              </p>
            )}
          </section>
        </div>

        <Dialog
          open={deleteOpen}
          onOpenChange={(open) => {
            if (!open) closeDeleteDialog()
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Project</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <p className="text-sm text-text-secondary">
                This will permanently delete project{" "}
                <span className="font-semibold text-text-primary">
                  {project?.name ?? "..."}
                </span>
                , all endpoints, groups, environments, and member access.
              </p>

              <Input
                label="Type project name to confirm"
                value={confirmProjectName}
                onChange={(e) => setConfirmProjectName(e.target.value)}
                placeholder={project?.name ?? "Project name"}
                autoFocus
              />

              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={closeDeleteDialog}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDeleteProject}
                  disabled={!isDeleteConfirmed || isDeletingProject || !project}
                >
                  {isDeletingProject ? "Deleting..." : "Delete Project"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={memberToRemove !== null}
          onOpenChange={(open) => {
            if (!open) setMemberToRemove(null)
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove Member</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <p className="text-sm text-text-secondary">
                Remove{" "}
                <span className="font-semibold text-text-primary">
                  {memberToRemove?.email ?? "..."}
                </span>{" "}
                from this project?
              </p>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setMemberToRemove(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleRemoveMember}
                  disabled={!memberToRemove || isRemovingMember}
                >
                  {isRemovingMember ? "Removing..." : "Remove Member"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}

function MemberListSkeleton() {
  return (
    <div className="rounded-lg border border-border-subtle overflow-hidden divide-y divide-border-subtle">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 bg-surface">
          <div className="w-7 h-7 rounded-full bg-overlay animate-pulse" />
          <div className="h-4 w-40 rounded bg-overlay animate-pulse" />
          <div className="ml-auto h-5 w-14 rounded-full bg-overlay animate-pulse" />
        </div>
      ))}
    </div>
  )
}
