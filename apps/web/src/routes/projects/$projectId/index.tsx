import { createFileRoute, redirect } from "@tanstack/react-router"
import { getOrFetchMe } from "@/features/auth/hooks"
import { ALL_GROUP_FILTER } from "@/features/projects/lib/group-filters"

export const Route = createFileRoute("/projects/$projectId/")({
  beforeLoad: async ({ context: { queryClient }, params, search }) => {
    const rawSearch = search as Record<string, unknown>
    const user = await getOrFetchMe(queryClient)
    if (!user) throw redirect({ to: "/auth/login" })

    throw redirect({
      to: "/projects/$projectId/endpoints",
      params,
      search: {
        filter:
          rawSearch.filter === "draft" || rawSearch.filter === "approved"
            ? rawSearch.filter
            : "all",
        q: typeof rawSearch.q === "string" ? rawSearch.q : "",
        group: typeof rawSearch.group === "string" ? rawSearch.group : ALL_GROUP_FILTER,
      },
    })
  },
  component: () => null,
})
