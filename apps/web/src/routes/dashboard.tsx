import * as React from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Plus, FolderKanban, AlertTriangle } from "lucide-react";
import { useProjects, useCreateProject } from "@/features/projects/hooks";
import { getOrFetchMe } from "@/features/auth/hooks";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/lib/toast";
import { ProjectCard } from "@/components/view/project-card";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await getOrFetchMe(queryClient);
    if (!user) throw redirect({ to: "/auth/login" });
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { data: projects = [], isLoading, isError } = useProjects();
  const [open, setOpen] = React.useState(false);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-foreground">Projects</h1>
            <p className="text-xs text-text-muted mt-0.5">
              {projects.length > 0
                ? `${projects.length} project${projects.length === 1 ? "" : "s"}`
                : "No projects yet"}
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus size={12} />
                New project
              </Button>
            </DialogTrigger>
            <NewProjectDialog onClose={() => setOpen(false)} />
          </Dialog>
        </div>

        {/* Projects grid */}
        {isLoading ? (
          <ProjectsGridSkeleton />
        ) : isError ? (
          <ErrorState message="Could not load projects. Please refresh." />
        ) : projects.length === 0 ? (
          <EmptyState onNew={() => setOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// ─── New Project Dialog ───────────────────────────────────────────────────────

function NewProjectDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const { mutate: create, isPending } = useCreateProject();
  const { toast } = useToast();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-secondary">
            Description
            <span className="text-text-muted font-normal ml-1">(optional)</span>
          </label>
          <textarea
            className="w-full rounded border border-border-default bg-elevated px-2.5 py-2 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:outline-none focus:border-accent resize-none h-16"
            placeholder="What is this project for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border-default py-20 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-default bg-elevated">
        <FolderKanban size={18} className="text-text-muted" />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary">No projects yet</p>
        <p className="text-xs text-text-muted mt-1">
          Create your first project to start defining API contracts
        </p>
      </div>
      <Button size="sm" onClick={onNew}>
        <Plus size={12} />
        New project
      </Button>
    </div>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
      <AlertTriangle size={18} className="text-error" />
      <p className="text-sm text-text-secondary">{message}</p>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProjectsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-24 rounded-lg border border-border-subtle bg-surface animate-pulse"
        />
      ))}
    </div>
  );
}
