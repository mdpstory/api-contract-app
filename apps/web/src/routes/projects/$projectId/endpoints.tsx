import { createFileRoute, redirect } from "@tanstack/react-router"
import { getOrFetchMe } from "@/features/auth/hooks"
import { ALL_GROUP_FILTER } from "@/features/projects/lib/group-filters"
import { ProjectSectionPage, type EndpointListSearch } from "../$projectId"

export const Route = createFileRoute("/projects/$projectId/endpoints")({
  validateSearch: (search: Record<string, unknown>) => ({
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
  component: ProjectEndpointsPage,
})

function ProjectEndpointsPage() {
  const { projectId } = Route.useParams()
  const searchState = Route.useSearch() as EndpointListSearch

  return (
    <ProjectSectionPage
      projectId={projectId}
      activeSection="endpoints"
      searchState={searchState}
    />
  )
}
