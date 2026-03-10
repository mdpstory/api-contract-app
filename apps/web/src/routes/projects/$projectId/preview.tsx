import { createFileRoute, redirect } from "@tanstack/react-router"
import { getOrFetchMe } from "@/features/auth/hooks"
import { ALL_GROUP_FILTER } from "@/features/projects/lib/group-filters"
import { ProjectSectionPage } from "../$projectId"

export const Route = createFileRoute("/projects/$projectId/preview")({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await getOrFetchMe(queryClient)
    if (!user) throw redirect({ to: "/auth/login" })
  },
  component: ProjectPreviewPage,
})

function ProjectPreviewPage() {
  const { projectId } = Route.useParams()

  return (
    <ProjectSectionPage
      projectId={projectId}
      activeSection="preview"
      searchState={{
        filter: "all",
        q: "",
        group: ALL_GROUP_FILTER,
      }}
    />
  )
}
