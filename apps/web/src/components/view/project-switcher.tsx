import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  CheckIcon,
  ChevronsUpDownIcon,
  FolderKanbanIcon,
  PlusIcon,
} from "lucide-react";
import { useCreateProject, useProjects } from "@/features/projects/hooks";
import { useToast } from "@/lib/toast";
import type { AppSidebarContext } from "../layout/app-sidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "../ui/sidebar";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface ProjectSwitcherProps {
  sidebarContext: AppSidebarContext;
}

export function ProjectSwitcher({ sidebarContext }: ProjectSwitcherProps) {
  const { isMobile } = useSidebar();
  const { data: projects = [], isLoading, isError } = useProjects();
  const [createProjectOpen, setCreateProjectOpen] = React.useState(false);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-none bg-sidebar-accent text-sidebar-accent-foreground">
                <FolderKanbanIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {sidebarContext.kind === "project"
                    ? sidebarContext.projectName
                    : "API Contract"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {sidebarContext.kind === "project"
                    ? (sidebarContext.projectDescription ?? "No description")
                    : "Choose a project"}
                </span>
              </div>
              <ChevronsUpDownIcon className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel>
              <div className="flex items-center justify-between">
                Projects
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Create project"
                  onClick={() => setCreateProjectOpen(true)}
                >
                  <PlusIcon className="size-4" />
                </Button>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isLoading ? (
              <DropdownMenuLabel>Loading projects...</DropdownMenuLabel>
            ) : isError ? (
              <DropdownMenuLabel>Failed to load projects</DropdownMenuLabel>
            ) : projects.length === 0 ? (
              <DropdownMenuLabel>No projects yet</DropdownMenuLabel>
            ) : (
              projects.map((project) => {
                const isActiveProject =
                  sidebarContext.kind === "project" &&
                  sidebarContext.projectId === project.id;

                if (
                  sidebarContext.kind === "project" &&
                  sidebarContext.active === "settings"
                ) {
                  return (
                    <DropdownMenuItem key={project.id} asChild>
                      <Link
                        to="/projects/$projectId/settings"
                        params={{ projectId: project.id }}
                        className="flex items-center gap-2"
                      >
                        <FolderKanbanIcon className="size-4" />
                        <div className="grid flex-1 text-left leading-tight">
                          <span className="truncate">{project.name}</span>
                        </div>
                        {isActiveProject ? (
                          <CheckIcon className="ml-auto size-4" />
                        ) : null}
                      </Link>
                    </DropdownMenuItem>
                  );
                }

                if (
                  sidebarContext.kind === "project" &&
                  sidebarContext.active === "environments"
                ) {
                  return (
                    <DropdownMenuItem key={project.id} asChild>
                      <Link
                        to="/projects/$projectId/environments"
                        params={{ projectId: project.id }}
                        className="flex items-center gap-2"
                      >
                        <FolderKanbanIcon className="size-4" />
                        <div className="grid flex-1 text-left leading-tight">
                          <span className="truncate">{project.name}</span>
                        </div>
                        {isActiveProject ? (
                          <CheckIcon className="ml-auto size-4" />
                        ) : null}
                      </Link>
                    </DropdownMenuItem>
                  );
                }

                return (
                  <DropdownMenuItem key={project.id} asChild>
                    <Link
                      to="/projects/$projectId/endpoints"
                      params={{ projectId: project.id }}
                      search={{ filter: "all", q: "", group: "__all__" }}
                      className="flex items-center gap-2"
                    >
                      <FolderKanbanIcon className="size-4" />
                      <div className="grid flex-1 text-left leading-tight">
                        <span className="truncate">{project.name}</span>
                      </div>
                      {isActiveProject ? (
                        <CheckIcon className="ml-auto size-4" />
                      ) : null}
                    </Link>
                  </DropdownMenuItem>
                );
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <Dialog open={createProjectOpen} onOpenChange={setCreateProjectOpen}>
          <NewProjectDialog onClose={() => setCreateProjectOpen(false)} />
        </Dialog>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function NewProjectDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const { mutate: create, isPending } = useCreateProject();
  const { toast } = useToast();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    create(
      { name, description: description || undefined },
      {
        onSuccess: () => {
          toast({ title: "Project created", variant: "success" });
          onClose();
        },
        onError: (err) =>
          toast({ title: "Error", description: err.message, variant: "error" }),
      },
    );
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New project</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          placeholder="Payment Service"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          autoFocus
        />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-secondary">
            Description
            <span className="ml-1 font-normal text-text-muted">(optional)</span>
          </label>
          <textarea
            className="h-16 w-full resize-none rounded border border-border-default bg-elevated px-2.5 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-accent focus:outline-none"
            placeholder="What is this project for?"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isPending || !name.trim()}>
            {isPending ? "Creating..." : "Create"}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}
