import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronRightIcon,
  FolderKanbanIcon,
  FolderIcon,
  LayersIcon,
  PlugZapIcon,
  PlusIcon,
  SettingsIcon,
  ZapIcon,
} from "lucide-react";
import { useMe } from "@/features/auth/hooks";
import {
  ALL_GROUP_FILTER,
  type GroupFilter,
  UNGROUPED_GROUP_FILTER,
} from "@/features/projects/lib/group-filters";
import { NavUser } from "../view/nav-user";
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
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "../ui/sidebar";
import type { EndpointListSearch } from "@/routes/projects/$projectId";
import type { Contract, ContractGroup } from "@repo/types";
import { TooltipProvider } from "../ui/tooltip";
import { ProjectSwitcher } from "../view/project-switcher";

export type AppSidebarContext =
  | {
      kind?: "dashboard";
      totalCount?: number;
      groupCounts?: Map<string, number>;
      ungroupedCount?: number;
    }
  | {
      kind: "project";
      projectId: string;
      projectName?: string;
      projectDescription?: string | null;
      active: "endpoints" | "environments" | "settings";
      endpointSearch?: EndpointListSearch;
      groups?: ContractGroup[];
      contracts?: Contract[];
      selectedGroup?: GroupFilter;
      activeContractId?: string;
      onSelectGroup?: (group: GroupFilter) => void;
      onCreateGroup?: () => void;
      onMoveContractGroup?: (contractId: string, groupId: string | null) => void;
      isMovingContract?: boolean;
      totalCount?: number;
      groupCounts?: Map<string, number>;
      ungroupedCount?: number;
    };

const METHOD_STYLES: Record<Contract["method"], string> = {
  GET: "text-emerald-700",
  POST: "text-sky-700",
  PUT: "text-amber-700",
  PATCH: "text-violet-700",
  DELETE: "text-rose-700",
};

export function AppSidebar({
  context,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  context?: AppSidebarContext;
}) {
  const { data: user } = useMe();
  const [groupQuery, setGroupQuery] = React.useState("");
  const [expandedGroupIds, setExpandedGroupIds] = React.useState<string[]>([]);
  const [draggingContractId, setDraggingContractId] = React.useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = React.useState<string | null>(null);
  const sidebarContext = context ?? { kind: "dashboard" as const };
  const defaultEndpointSearch: EndpointListSearch = {
    filter: "all",
    q: "",
    group: ALL_GROUP_FILTER,
  };

  const isProject = sidebarContext.kind === "project";
  const active = isProject ? sidebarContext.active : undefined;
  const projectId = isProject ? sidebarContext.projectId : undefined;
  const endpointSearch = isProject
    ? (sidebarContext.endpointSearch ?? defaultEndpointSearch)
    : defaultEndpointSearch;

  const groups = isProject ? (sidebarContext.groups ?? []) : [];
  const contracts = isProject ? (sidebarContext.contracts ?? []) : [];
  const sidebarQuery = groupQuery.trim().toLowerCase();

  const statusFilteredContracts = React.useMemo(() => {
    return contracts.filter((contract) => {
      return (
        endpointSearch.filter === "all" ||
        contract.status === endpointSearch.filter
      );
    });
  }, [contracts, endpointSearch.filter]);

  const searchFilteredContracts = React.useMemo(() => {
    const query = endpointSearch.q.trim().toLowerCase();
    if (!query) return statusFilteredContracts;

    return statusFilteredContracts.filter((contract) => {
      return (
        contract.path.toLowerCase().includes(query) ||
        contract.method.toLowerCase().includes(query) ||
        contract.name.toLowerCase().includes(query)
      );
    });
  }, [endpointSearch.q, statusFilteredContracts]);

  const visibleContracts = searchFilteredContracts;
  const visibleGroups = groups;

  const filteredGroups = React.useMemo(() => {
    const query = groupQuery.trim().toLowerCase();
    if (!query) return visibleGroups;

    return visibleGroups.filter((group) => {
      const matchesGroup = group.name.toLowerCase().includes(query);
      const matchesContract = visibleContracts.some(
        (contract) =>
          contract.groupId === group.id &&
          (contract.path.toLowerCase().includes(query) ||
            contract.method.toLowerCase().includes(query) ||
            contract.name.toLowerCase().includes(query)),
      );

      return matchesGroup || matchesContract;
    });
  }, [groupQuery, visibleContracts, visibleGroups]);

  const ungroupedContracts = React.useMemo(() => {
    return visibleContracts.filter(
      (contract) => !contract.groupId || !groups.some((group) => group.id === contract.groupId),
    );
  }, [groups, visibleContracts]);

  const filteredUngroupedContracts = React.useMemo(() => {
    if (!sidebarQuery) return ungroupedContracts;

    return ungroupedContracts.filter(
      (contract) =>
        contract.path.toLowerCase().includes(sidebarQuery) ||
        contract.method.toLowerCase().includes(sidebarQuery) ||
        contract.name.toLowerCase().includes(sidebarQuery),
    );
  }, [sidebarQuery, ungroupedContracts]);

  const showUngroupedGroup =
    (sidebarContext.ungroupedCount ?? ungroupedContracts.length) > 0 ||
    filteredUngroupedContracts.length > 0 ||
    draggingContractId !== null;
  const isUngroupedExpanded = expandedGroupIds.includes(UNGROUPED_GROUP_FILTER);

  React.useEffect(() => {
    if (!isProject || active !== "endpoints") return;

    setExpandedGroupIds((current) => {
      if (current.length > 0) return current;

      return [
        ...groups.map((group) => group.id),
        ...(showUngroupedGroup ? [UNGROUPED_GROUP_FILTER] : []),
      ];
    });
  }, [groups, isProject, showUngroupedGroup, active]);

  function toggleGroup(groupId: string) {
    setExpandedGroupIds((current) =>
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId],
    );
  }

  function clearSidebarDragState() {
    setDraggingContractId(null);
    setDragOverTarget(null);
  }

  function handleSidebarContractDragStart(
    contractId: string,
    event: React.DragEvent<HTMLAnchorElement>,
  ) {
    if (!isProject || sidebarContext.isMovingContract) return;

    setDraggingContractId(contractId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-contract-id", contractId);
    event.dataTransfer.setData("text/plain", contractId);
  }

  function handleSidebarDropZoneDragOver(
    target: string,
    event: React.DragEvent<HTMLButtonElement>,
  ) {
    if (!draggingContractId || !isProject || sidebarContext.isMovingContract) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    if (dragOverTarget !== target) {
      setDragOverTarget(target);
    }
  }

  function handleSidebarDropOnTarget(
    target: string,
    event: React.DragEvent<HTMLButtonElement>,
  ) {
    if (!isProject || sidebarContext.isMovingContract) return;

    event.preventDefault();

    const draggedId =
      draggingContractId ||
      event.dataTransfer.getData("application/x-contract-id") ||
      event.dataTransfer.getData("text/plain");

    if (!draggedId) {
      clearSidebarDragState();
      return;
    }

    const draggedContract = contracts.find((contract) => contract.id === draggedId);

    if (!draggedContract) {
      clearSidebarDragState();
      return;
    }

    const nextGroupId =
      target === UNGROUPED_GROUP_FILTER ? null : target;

    if ((draggedContract.groupId ?? null) === nextGroupId) {
      clearSidebarDragState();
      return;
    }

    sidebarContext.onMoveContractGroup?.(draggedContract.id, nextGroupId);
    clearSidebarDragState();
  }

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
                    <ZapIcon className="size-4" />
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

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild={isProject}
                      isActive={
                        isProject && active === "endpoints"
                      }
                      tooltip={{
                        children: isProject
                          ? "Endpoints"
                          : "Select a project first",
                        hidden: false,
                      }}
                      className="px-2.5 md:px-2"
                      disabled={!isProject}
                    >
                      {isProject ? (
                        <Link
                          to="/projects/$projectId/endpoints"
                          params={{ projectId: projectId! }}
                          search={endpointSearch}
                        >
                          <PlugZapIcon />
                          <span>Endpoints</span>
                        </Link>
                      ) : (
                        <>
                          <PlugZapIcon />
                          <span>Endpoints</span>
                        </>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild={isProject}
                      isActive={
                        isProject && active === "environments"
                      }
                      tooltip={{
                        children: isProject
                          ? "Environments"
                          : "Select a project first",
                        hidden: false,
                      }}
                      className="px-2.5 md:px-2"
                      disabled={!isProject}
                    >
                      {isProject ? (
                        <Link
                          to="/projects/$projectId/environments"
                          params={{ projectId: projectId! }}
                        >
                          <LayersIcon />
                          <span>Environments</span>
                        </Link>
                      ) : (
                        <>
                          <LayersIcon />
                          <span>Environments</span>
                        </>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild={isProject}
                      isActive={
                        isProject && active === "settings"
                      }
                      tooltip={{
                        children: isProject
                          ? "Settings"
                          : "Select a project first",
                        hidden: false,
                      }}
                      className="px-2.5 md:px-2"
                      disabled={!isProject}
                    >
                      {isProject ? (
                        <Link
                          to="/projects/$projectId/settings"
                          params={{ projectId: projectId! }}
                        >
                          <SettingsIcon />
                          <span>Settings</span>
                        </Link>
                      ) : (
                        <>
                          <SettingsIcon />
                          <span>Settings</span>
                        </>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
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
          <ProjectSwitcher sidebarContext={sidebarContext} />

          {isProject && active === "endpoints" ? (
            <SidebarInput
              placeholder="Search groups or endpoints..."
              value={groupQuery}
              onChange={(event) => setGroupQuery(event.target.value)}
            />
          ) : null}
        </SidebarHeader>

        <SidebarContent>
          {isProject && active === "endpoints" ? (
            <SidebarGroup className="px-0">
              <SidebarGroupLabel className="px-4">Groups</SidebarGroupLabel>
              <SidebarGroupAction
                type="button"
                onClick={sidebarContext.onCreateGroup}
                title="Create group"
              >
                <PlusIcon />
              </SidebarGroupAction>
              <SidebarGroupContent className="px-2">
                <SidebarMenu>
                  {filteredGroups.map((group) => {
                    const isExpanded = expandedGroupIds.includes(group.id);
                    const isDropTarget = dragOverTarget === group.id;
                    const groupContracts = visibleContracts.filter(
                      (contract) =>
                        contract.groupId === group.id &&
                        (!sidebarQuery ||
                          contract.path.toLowerCase().includes(sidebarQuery) ||
                          contract.method.toLowerCase().includes(sidebarQuery) ||
                          contract.name.toLowerCase().includes(sidebarQuery)),
                    );

                    return (
                      <SidebarMenuItem key={group.id}>
                        <SidebarMenuButton
                          className={isDropTarget ? "bg-sidebar-accent text-sidebar-accent-foreground" : undefined}
                          onClick={() => toggleGroup(group.id)}
                          onDragOver={(event) =>
                            handleSidebarDropZoneDragOver(group.id, event)
                          }
                          onDrop={(event) => handleSidebarDropOnTarget(group.id, event)}
                        >
                          <ChevronRightIcon
                            className={[
                              "size-4 transition-transform",
                              isExpanded ? "rotate-90" : "",
                            ].join(" ")}
                          />
                          <FolderIcon />
                          <span>{group.name}</span>
                        </SidebarMenuButton>
                        <SidebarMenuBadge>
                          {sidebarContext.groupCounts?.get(group.id) ?? 0}
                        </SidebarMenuBadge>
                        {isExpanded ? (
                          <SidebarMenuSub className="ml-3.5 mr-0 pr-0">
                            {groupContracts.length > 0 ? (
                              groupContracts.map((contract) => (
                                <SidebarMenuSubItem key={contract.id}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={sidebarContext.activeContractId === contract.id}
                                    className="w-full"
                                  >
                                    <Link
                                      to="/projects/$projectId/contracts/$contractId"
                                      params={{
                                        projectId: projectId!,
                                        contractId: contract.id,
                                      }}
                                      draggable={!sidebarContext.isMovingContract}
                                      onDragStart={(event) =>
                                        handleSidebarContractDragStart(contract.id, event)
                                      }
                                      onDragEnd={clearSidebarDragState}
                                      search={{
                                        listSection: "endpoints",
                                        listFilter: endpointSearch.filter,
                                        listQ: endpointSearch.q,
                                        listGroup: endpointSearch.group,
                                        tab: "definition",
                                        definitionTab: "request",
                                      }}
                                    >
                                      <span
                                        className={[
                                          "w-10 shrink-0 rounded-none bg-sidebar-accent/40 px-1 py-0.5 text-center font-mono text-[10px] font-semibold",
                                          METHOD_STYLES[contract.method],
                                        ].join(" ")}
                                      >
                                        {contract.method}
                                      </span>
                                      <span className="truncate font-mono text-[11px]">
                                        {contract.path}
                                      </span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))
                            ) : (
                              <SidebarMenuSubItem>
                                <div className="px-2 py-1 text-[11px] text-muted-foreground">
                                  No endpoints
                                </div>
                              </SidebarMenuSubItem>
                            )}
                          </SidebarMenuSub>
                        ) : null}
                      </SidebarMenuItem>
                    );
                  })}

                  {showUngroupedGroup ? (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        className={
                          dragOverTarget === UNGROUPED_GROUP_FILTER
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : undefined
                        }
                        onClick={() => toggleGroup(UNGROUPED_GROUP_FILTER)}
                        onDragOver={(event) =>
                          handleSidebarDropZoneDragOver(
                            UNGROUPED_GROUP_FILTER,
                            event,
                          )
                        }
                        onDrop={(event) =>
                          handleSidebarDropOnTarget(UNGROUPED_GROUP_FILTER, event)
                        }
                      >
                        <ChevronRightIcon
                          className={[
                            "size-4 transition-transform",
                            isUngroupedExpanded ? "rotate-90" : "",
                          ].join(" ")}
                        />
                        <FolderIcon />
                        <span>Ungrouped</span>
                      </SidebarMenuButton>
                      <SidebarMenuBadge>
                        {sidebarContext.ungroupedCount ?? ungroupedContracts.length}
                      </SidebarMenuBadge>
                      {isUngroupedExpanded ? (
                        <SidebarMenuSub className="ml-3.5 mr-0 pr-0">
                          {filteredUngroupedContracts.length > 0 ? (
                            filteredUngroupedContracts.map((contract) => (
                              <SidebarMenuSubItem key={contract.id}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={sidebarContext.activeContractId === contract.id}
                                  className="w-full"
                                >
                                  <Link
                                    to="/projects/$projectId/contracts/$contractId"
                                    params={{
                                      projectId: projectId!,
                                      contractId: contract.id,
                                    }}
                                    draggable={!sidebarContext.isMovingContract}
                                    onDragStart={(event) =>
                                      handleSidebarContractDragStart(contract.id, event)
                                    }
                                    onDragEnd={clearSidebarDragState}
                                    search={{
                                      listSection: "endpoints",
                                      listFilter: endpointSearch.filter,
                                      listQ: endpointSearch.q,
                                      listGroup: endpointSearch.group,
                                      tab: "definition",
                                      definitionTab: "request",
                                    }}
                                  >
                                    <span
                                      className={[
                                        "w-10 shrink-0 rounded-none bg-sidebar-accent/40 px-1 py-0.5 text-center font-mono text-[10px] font-semibold",
                                        METHOD_STYLES[contract.method],
                                      ].join(" ")}
                                    >
                                      {contract.method}
                                    </span>
                                    <span className="truncate font-mono text-[11px]">
                                      {contract.path}
                                    </span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))
                          ) : (
                            <SidebarMenuSubItem>
                              <div className="px-2 py-1 text-[11px] text-muted-foreground">
                                No endpoints
                              </div>
                            </SidebarMenuSubItem>
                          )}
                        </SidebarMenuSub>
                      ) : null}
                    </SidebarMenuItem>
                  ) : null}
                </SidebarMenu>

                {filteredGroups.length === 0 &&
                filteredUngroupedContracts.length === 0 &&
                groupQuery ? (
                  <div className="px-2 py-4 text-xs text-muted-foreground">
                    No groups or endpoints match your search.
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
                          params={{ projectId: projectId! }}
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
