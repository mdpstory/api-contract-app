import { createFileRoute, redirect } from "@tanstack/react-router"
import { getOrFetchMe } from "@/features/auth/hooks"
import { ProjectHomePage } from "../$projectId"
import { ALL_GROUP_FILTER } from "@/features/projects/components/project-sidebar"

export const Route = createFileRoute("/projects/$projectId/")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: search.tab === "preview-all" ? "preview-all" : "endpoints",
    filter:
      search.filter === "draft" || search.filter === "approved"
        ? search.filter
        : "all",
    q: typeof search.q === "string" ? search.q : "",
    group: typeof search.group === "string" ? search.group : ALL_GROUP_FILTER,
  }),
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await getOrFetchMe(queryClient)
    if (!user) throw redirect({ to: "/auth/login" })
  },
  component: ProjectIndexPage,
})

function ProjectIndexPage() {
  const { projectId } = Route.useParams()
  return <ProjectHomePage projectId={projectId} />
}
