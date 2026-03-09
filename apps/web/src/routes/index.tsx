import { createFileRoute, redirect } from "@tanstack/react-router"
import { getOrFetchMe } from "@/features/auth/hooks"

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await getOrFetchMe(queryClient)
    if (user) {
      throw redirect({ to: "/dashboard" })
    } else {
      throw redirect({ to: "/auth/login" })
    }
  },
  component: () => null,
})
