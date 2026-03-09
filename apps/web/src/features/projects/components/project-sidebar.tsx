import { Link } from "@tanstack/react-router"
import { type LucideIcon, Globe, Layers, Settings, Plus, FolderKanban } from "lucide-react"
import { cn } from "@/lib/cn"
import { useProject } from "@/features/projects/hooks"
import type { ContractGroup } from "@repo/types"

export const ALL_GROUP_FILTER = "__all__" as const
export const UNGROUPED_GROUP_FILTER = "__ungrouped__" as const

export type GroupFilter =
  | typeof ALL_GROUP_FILTER
  | typeof UNGROUPED_GROUP_FILTER
  | string

interface ProjectSidebarProps {
  projectId: string
  active: "endpoints" | "environments" | "settings"
  endpointSearch?: {
    tab: "endpoints" | "preview-all"
    filter: "all" | "draft" | "approved"
    q: string
    group: string
  }
  groups?: ContractGroup[]
  selectedGroup?: GroupFilter
  onSelectGroup?: (group: GroupFilter) => void
  onCreateGroup?: () => void
  totalCount?: number
  groupCounts?: Map<string, number>
  ungroupedCount?: number
}

interface SidebarLinkProps {
  projectId: string
  to:
    | "/projects/$projectId"
    | "/projects/$projectId/environments"
    | "/projects/$projectId/settings"
  label: string
  icon: LucideIcon
  active: boolean
  count?: number
  search?: {
    tab: "endpoints" | "preview-all"
    filter: "all" | "draft" | "approved"
    q: string
    group: string
  }
}

function SidebarLink({ projectId, to, label, icon: Icon, active, count, search }: SidebarLinkProps) {
  return (
    <Link
      to={to}
      params={{ projectId }}
      search={search ?? {
        tab: "endpoints",
        filter: "all",
        q: "",
        group: ALL_GROUP_FILTER,
      }}
      className={cn(
        "flex items-center gap-2 rounded px-2.5 py-1.5 font-mono text-sm transition-colors",
        active
          ? "bg-accent/10 text-accent font-medium"
          : "text-text-secondary hover:bg-overlay hover:text-text-primary font-normal"
      )}
    >
      <Icon size={14} className="shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span className="text-[10px] font-medium text-text-muted tabular-nums">
          {count}
        </span>
      )}
    </Link>
  )
}

function GroupButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2.5 py-1.5 font-mono text-[13px] transition-colors text-left",
        active
          ? "bg-overlay text-text-primary font-medium"
          : "text-text-muted hover:bg-overlay/60 hover:text-text-secondary font-normal"
      )}
    >
      <span className="flex-1 truncate">{label}</span>
      <span className="shrink-0 text-[10px] font-medium text-text-muted tabular-nums">
        {count}
      </span>
    </button>
  )
}

export function ProjectSidebar({
  projectId,
  active,
  endpointSearch,
  groups = [],
  selectedGroup = ALL_GROUP_FILTER,
  onSelectGroup,
  onCreateGroup,
  totalCount = 0,
  groupCounts,
  ungroupedCount = 0,
}: ProjectSidebarProps) {
  const { data: project } = useProject(projectId)

  return (
    <aside className="flex flex-col border-b border-border-subtle bg-surface lg:sticky lg:top-0 lg:h-[calc(100vh-3rem)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
      {/* Project identity */}
      <div className="px-3 py-3 border-b border-border-subtle">
        <Link
          to="/dashboard"
          className="group flex items-center gap-2.5 rounded px-1 py-1.5"
          title="Back to all projects"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border-default bg-elevated">
            <FolderKanban size={13} className="text-text-secondary" />
          </div>
          <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-sm font-medium leading-tight text-text-primary transition-colors group-hover:text-accent">
                {project?.name ?? "Loading..."}
              </p>
              {project?.description && (
                <p className="mt-0.5 truncate font-mono text-[11px] leading-tight text-text-muted">
                  {project.description}
                </p>
              )}
          </div>
        </Link>
      </div>

      {/* Primary nav */}
      <nav className="px-2 py-2 border-b border-border-subtle space-y-0.5">
        <SidebarLink
          projectId={projectId}
          to="/projects/$projectId"
          label="Endpoints"
          icon={Layers}
          active={active === "endpoints"}
          count={totalCount > 0 ? totalCount : undefined}
          search={endpointSearch}
        />
        <SidebarLink
          projectId={projectId}
          to="/projects/$projectId/environments"
          label="Environments"
          icon={Globe}
          active={active === "environments"}
        />
        <SidebarLink
          projectId={projectId}
          to="/projects/$projectId/settings"
          label="Settings"
          icon={Settings}
          active={active === "settings"}
        />
      </nav>

      {/* Groups panel - visible on endpoints page */}
      {onSelectGroup && active === "endpoints" && (
        <div className="px-2 py-2 flex-1">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Groups
            </span>
            {onCreateGroup && (
              <button
                type="button"
                onClick={onCreateGroup}
                title="New group"
                className="rounded p-0.5 text-text-muted hover:text-text-primary hover:bg-overlay transition-colors"
              >
                <Plus size={11} />
              </button>
            )}
          </div>

          <div className="mt-1 space-y-0.5">
            <GroupButton
              label="All"
              count={totalCount}
              active={selectedGroup === ALL_GROUP_FILTER}
              onClick={() => onSelectGroup(ALL_GROUP_FILTER)}
            />
            {groups.map((group) => (
              <GroupButton
                key={group.id}
                label={group.name}
                count={groupCounts?.get(group.id) ?? 0}
                active={selectedGroup === group.id}
                onClick={() => onSelectGroup(group.id)}
              />
            ))}
            <GroupButton
              label="Ungrouped"
              count={ungroupedCount}
              active={selectedGroup === UNGROUPED_GROUP_FILTER}
              onClick={() => onSelectGroup(UNGROUPED_GROUP_FILTER)}
            />
          </div>
        </div>
      )}
    </aside>
  )
}
