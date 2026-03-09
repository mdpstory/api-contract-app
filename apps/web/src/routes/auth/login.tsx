import { createFileRoute, redirect } from "@tanstack/react-router"
import * as React from "react"
import { useSendMagicLink } from "@/features/auth/hooks"
import { useToast } from "@/lib/toast"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { getOrFetchMe } from "@/features/auth/hooks"

export const Route = createFileRoute("/auth/login")({
  beforeLoad: async ({ context: { queryClient } }) => {
    const user = await getOrFetchMe(queryClient)
    if (user) throw redirect({ to: "/dashboard" })
  },
  component: LoginPage,
})

function LoginPage() {
  const [email, setEmail] = React.useState("")
  const [sent, setSent] = React.useState(false)
  const { mutate: sendLink, isPending } = useSendMagicLink()
  const { toast } = useToast()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    sendLink(email, {
      onSuccess: () => setSent(true),
      onError: (err) =>
        toast({ title: "Error", description: err.message, variant: "error" }),
    })
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
            <span className="text-2xl">✉️</span>
          </div>
          <h2 className="text-lg font-semibold text-text-primary">
            Check your email
          </h2>
          <p className="text-sm text-text-secondary">
            We sent a magic link to <span className="text-text-primary font-medium">{email}</span>.
            Click the link to sign in. It expires in 15 minutes.
          </p>
          <p className="text-xs text-text-muted">
            If email does not arrive in development, check the API terminal log.
          </p>
          <button
            onClick={() => setSent(false)}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            Use a different email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            API Contract
          </h1>
          <p className="text-sm text-text-secondary">
            Sign in to manage your API contracts
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <Button
            type="submit"
            className="w-full"
            disabled={isPending || !email}
          >
            {isPending ? "Sending..." : "Send Magic Link"}
          </Button>
        </form>

        <p className="text-xs text-text-muted text-center">
          No password required. We&apos;ll send a secure login link.
        </p>

        {import.meta.env.DEV && (
          <p className="text-xs text-text-muted text-center border border-border-subtle rounded-md px-3 py-2">
            <span className="font-medium text-text-secondary">Dev tip:</span> Leave{" "}
            <code className="font-mono">RESEND_API_KEY</code> empty in{" "}
            <code className="font-mono">apps/api/.env</code> to print magic links to the API terminal instead of sending email.
          </p>
        )}
      </div>
    </div>
  )
}
