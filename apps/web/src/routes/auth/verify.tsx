import { createFileRoute, useRouter } from "@tanstack/react-router"
import * as React from "react"
import { verifyToken } from "@/features/auth/api"
import { useQueryClient } from "@tanstack/react-query"
import { authKeys } from "@/features/auth/hooks"
import { Spinner } from "@/components/ui/spinner"

export const Route = createFileRoute("/auth/verify")({
  component: VerifyPage,
})

function VerifyPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [error, setError] = React.useState<string | null>(null)

  // useRef to ensure the verify call runs only once
  // even in React StrictMode (which mounts components twice in dev)
  const hasRun = React.useRef(false)

  React.useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    const params = new URLSearchParams(window.location.search)
    const token = params.get("token")

    if (!token) {
      setError("Invalid link. No token found.")
      return
    }

    verifyToken(token)
      .then((user) => {
        queryClient.setQueryData(authKeys.me, user)
        void router.navigate({ to: "/dashboard", replace: true })
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Verification failed"
        setError(message)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base">
        <div className="w-full max-w-sm space-y-4 rounded-lg border border-border-subtle bg-surface p-8 text-center shadow-brutal-lg">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-error/20 bg-error/10">
            <span className="text-xl text-error">✕</span>
          </div>
          <h2 className="text-lg font-semibold text-text-primary">
            Link Invalid or Expired
          </h2>
          <p className="text-sm text-text-secondary">{error}</p>
          <a
            href="/auth/login"
            className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            Back to login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base">
      <div className="flex flex-col items-center gap-4 rounded-lg border border-border-subtle bg-surface px-8 py-10 shadow-brutal-lg">
        <Spinner size="lg" />
        <p className="text-sm text-text-secondary">Signing you in...</p>
      </div>
    </div>
  )
}
