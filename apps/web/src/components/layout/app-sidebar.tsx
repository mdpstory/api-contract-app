import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  CommandIcon,
  FolderKanbanIcon,
  LayersIcon,
  PlugZapIcon,
  PlusIcon,
  SettingsIcon,
} from "lucide-react";
import { useMe } from "@/features/auth/hooks";
import {
  ALL_GROUP_FILTER,
  type GroupFilter,
  UNGROUPED_GROUP_FILTER,
} from "@/features/projects/lib/group-filters";
import { NavUser } from "../ui/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";
import type { EndpointListSearch } from "@/routes/projects/$projectId";
import type { ContractGroup } from "@repo/types";
import { TooltipProvider } from "../ui/tooltip";

export type AppSidebarContext =
  | {
      kind?: "dashboard";
    }
  | {
      kind: "project";
      projectId: string;
      projectName?: string;
      projectDescription?: string | null;
      active: "endpoints" | "environments" | "settings";
      endpointSearch?: EndpointListSearch;
      groups?: ContractGroup[];
      selectedGroup?: GroupFilter;
      onSelectGroup?: (group: GroupFilter) => void;
      onCreateGroup?: () => void;
      totalCount?: number;
      groupCounts?: Map<string, number>;
      ungroupedCount?: number;
    };

function GroupButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center gap-2 rounded-none px-2 py-1.5 text-left text-xs transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      ].join(" ")}
    >
      <span className="truncate">{label}</span>
      <span className="ml-auto text-[10px] tabular-nums text-sidebar-foreground/50">
        {count}
      </span>
    </button>
  );
}

export function AppSidebar({
  context,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  context?: AppSidebarContext;
}) {
  const { data: user } = useMe();
  const [groupQuery, setGroupQuery] = React.useState("");
  const sidebarContext = context ?? { kind: "dashboard" as const };
  const defaultEndpointSearch: EndpointListSearch = {
    filter: "all",
    q: "",
    group: ALL_GROUP_FILTER,
  };

  const isProject = sidebarContext.kind === "project";
  const endpointSearch = isProject
    ? (sidebarContext.endpointSearch ?? defaultEndpointSearch)
    : defaultEndpointSearch;

  const groups = isProject ? (sidebarContext.groups ?? []) : [];
  const filteredGroups = React.useMemo(() => {
    const query = groupQuery.trim().toLowerCase();
    if (!query) return groups;

    return groups.filter((group) => group.name.toLowerCase().includes(query));
  }, [groupQuery, groups]);

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden *:data-[sidebar=sidebar]:flex-row"
      {...props}
    >
      <Sidebar
        collapsible="none"
        className="w-[calc(var(--sidebar-width-icon)+1px)]! border-r"
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild className="md:h-8 md:p-0">
                <Link to="/dashboard">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-none bg-sidebar-primary text-sidebar-primary-foreground">
                    <CommandIcon className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">API Contract</span>
                    <span className="truncate text-xs">Workspace</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent className="px-1.5 md:px-0">
              <TooltipProvider>
                <SidebarMenu className="gap-y-2">
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={!isProject}
                      tooltip={{ children: "Projects", hidden: false }}
                      className="px-2.5 md:px-2"
                    >
                      <Link to="/dashboard">
                        <FolderKanbanIcon />
                        <span>Projects</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  {isProject ? (
                    <>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={sidebarContext.active === "endpoints"}
                          tooltip={{ children: "Endpoints", hidden: false }}
                          className="px-2.5 md:px-2"
                        >
                          <Link
                            to="/projects/$projectId/endpoints"
                            params={{ projectId: sidebarContext.projectId }}
                            search={endpointSearch}
                          >
                            <PlugZapIcon />
                            <span>Endpoints</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={sidebarContext.active === "environments"}
                          tooltip={{ children: "Environments", hidden: false }}
                          className="px-2.5 md:px-2"
                        >
                          <Link
                            to="/projects/$projectId/environments"
                            params={{ projectId: sidebarContext.projectId }}
                          >
                            <LayersIcon />
                            <span>Environments</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={sidebarContext.active === "settings"}
                          tooltip={{ children: "Settings", hidden: false }}
                          className="px-2.5 md:px-2"
                        >
                          <Link
                            to="/projects/$projectId/settings"
                            params={{ projectId: sidebarContext.projectId }}
                          >
                            <SettingsIcon />
                            <span>Settings</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </>
                  ) : null}
                </SidebarMenu>
              </TooltipProvider>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {user ? (
          <SidebarFooter>
            <NavUser
              user={{
                name: user.name ?? user.email,
                email: user.email,
                avatar: "",
              }}
            />
          </SidebarFooter>
        ) : null}
      </Sidebar>

      <Sidebar collapsible="none" className="hidden flex-1 md:flex">
        <SidebarHeader className="gap-3.5 border-b p-4">
          <div className="flex w-full items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-medium text-foreground">
                {isProject
                  ? (sidebarContext.projectName ?? "Project")
                  : "Projects"}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {isProject
                  ? sidebarContext.active === "endpoints"
                    ? "Browse endpoint groups"
                    : sidebarContext.active === "environments"
                      ? "Manage environment variables"
                      : "Project settings"
                  : "Open a project to see its sections"}
              </div>
            </div>

            {isProject && sidebarContext.active === "endpoints" ? (
              <button
                type="button"
                onClick={sidebarContext.onCreateGroup}
                className="flex size-7 items-center justify-center rounded-none text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                title="New group"
              >
                <PlusIcon className="size-4" />
              </button>
            ) : null}
          </div>

          {isProject && sidebarContext.active === "endpoints" ? (
            <SidebarInput
              placeholder="Search groups..."
              value={groupQuery}
              onChange={(event) => setGroupQuery(event.target.value)}
            />
          ) : null}
        </SidebarHeader>

        <SidebarContent>
          {isProject && sidebarContext.active === "endpoints" ? (
            <SidebarGroup className="px-0">
              <SidebarGroupLabel className="px-4">Groups</SidebarGroupLabel>
              <SidebarGroupAction
                type="button"
                onClick={sidebarContext.onCreateGroup}
                title="Create group"
              >
                <PlusIcon />
              </SidebarGroupAction>
              <SidebarGroupContent className="space-y-1 px-2">
                <GroupButton
                  label="All"
                  count={sidebarContext.totalCount ?? 0}
                  active={
                    (sidebarContext.selectedGroup ?? ALL_GROUP_FILTER) ===
                    ALL_GROUP_FILTER
                  }
                  onClick={() =>
                    sidebarContext.onSelectGroup?.(ALL_GROUP_FILTER)
                  }
                />

                {filteredGroups.map((group) => (
                  <GroupButton
                    key={group.id}
                    label={group.name}
                    count={sidebarContext.groupCounts?.get(group.id) ?? 0}
                    active={sidebarContext.selectedGroup === group.id}
                    onClick={() => sidebarContext.onSelectGroup?.(group.id)}
                  />
                ))}

                <GroupButton
                  label="Ungrouped"
                  count={sidebarContext.ungroupedCount ?? 0}
                  active={
                    sidebarContext.selectedGroup === UNGROUPED_GROUP_FILTER
                  }
                  onClick={() =>
                    sidebarContext.onSelectGroup?.(UNGROUPED_GROUP_FILTER)
                  }
                />

                {filteredGroups.length === 0 && groupQuery ? (
                  <div className="px-2 py-4 text-xs text-muted-foreground">
                    No groups match your search.
                  </div>
                ) : null}
              </SidebarGroupContent>
            </SidebarGroup>
          ) : isProject ? (
            <SidebarGroup className="px-0">
              <SidebarGroupContent className="p-4 text-xs text-muted-foreground">
                <div className="space-y-3">
                  <p>
                    {sidebarContext.projectDescription ??
                      "No project description yet."}
                  </p>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <Link
                          to="/projects/$projectId/endpoints"
                          params={{ projectId: sidebarContext.projectId }}
                          search={endpointSearch}
                        >
                          <LayersIcon />
                          <span>Back to endpoints</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </div>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : (
            <SidebarGroup className="px-0">
              <SidebarGroupContent className="p-4 text-xs text-muted-foreground">
                Select a project from the dashboard to manage endpoints,
                environments, and settings.
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>
      </Sidebar>
    </Sidebar>
  );
}
