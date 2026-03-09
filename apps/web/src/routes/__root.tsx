import { createRootRouteWithContext, Outlet } from "@tanstack/react-router"
import { ToastProviderWrapper } from "@/lib/toast"
import type { QueryClient } from "@tanstack/react-query"

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <ToastProviderWrapper>
      <Outlet />
    </ToastProviderWrapper>
  ),
})
