import type { Project } from "@repo/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Link } from "@tanstack/react-router";
import { ClockIcon, FolderKanbanIcon } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";
import { Separator } from "../ui/separator";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      to="/projects/$projectId/endpoints"
      params={{ projectId: project.id }}
      search={{ filter: "all", q: "", group: "__all__" }}
    >
      <Card className="group bg-card/50 hover:bg-card transition-colors hover:ring-foreground/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-2 mr-2">
              <FolderKanbanIcon size={16} className="text-primary" />
            </div>
            <div>
              <CardTitle>{project.name}</CardTitle>
              <CardDescription className="line-clamp-1">
                {project.description ?? "No description"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <div className="px-4 -my-1">
          <Separator />
        </div>
        <CardContent className="flex items-center gap-2 text-xs font-light text-muted-foreground">
          <ClockIcon size={14} />
          <p>{formatRelativeTime(project.createdAt)}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
