import * as React from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { LogOut, ChevronRight, Zap } from "lucide-react"
import { useMe, useLogout } from "@/features/auth/hooks"
import { cn } from "@/lib/cn"
import { useToast } from "@/lib/toast"

interface AppLayoutProps {
  children: React.ReactNode
  breadcrumbs?: Array<{ label: string; href?: string }>
  mainClassName?: string
}

export function AppLayout({ children, breadcrumbs, mainClassName }: AppLayoutProps) {
  const { data: user } = useMe()
  const { mutate: logout } = useLogout()
  const navigate = useNavigate()
  const { toast } = useToast()

  function handleLogout() {
    logout(undefined, {
      onSuccess: () => void navigate({ to: "/auth/login" }),
      onError: () => toast({ title: "Sign out failed", description: "Please try again.", variant: "error" }),
    })
  }

  return (
    <div className="min-h-screen bg-base flex flex-col">
      {/* Header */}
      <header className="h-12 border-b border-border-subtle bg-surface flex items-center px-4 gap-3 shrink-0">
        {/* Logo */}
        <Link
          to="/dashboard"
          className="group flex shrink-0 items-center gap-1.5"
        >
          <div className="flex h-6 w-6 items-center justify-center rounded bg-accent/10 border border-accent/20">
            <Zap size={12} className="text-accent" />
          </div>
          <span className="hidden font-mono text-sm font-semibold text-text-primary sm:block">
            API Contract
          </span>
        </Link>

        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex min-w-0 flex-1 items-center gap-1 font-mono">
            <ChevronRight size={12} className="text-text-muted shrink-0" />
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                {crumb.href ? (
                  <Link
                    to={crumb.href}
                    className="max-w-[160px] truncate text-xs text-text-secondary transition-colors hover:text-text-primary"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="max-w-[200px] truncate text-xs font-medium text-text-primary">
                    {crumb.label}
                  </span>
                )}
                {i < breadcrumbs.length - 1 && (
                  <ChevronRight size={12} className="text-text-muted shrink-0" />
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        {/* Right: user + logout */}
        <div className="ml-auto flex items-center gap-2">
          {user && (
            <span className="hidden max-w-[180px] truncate font-mono text-xs text-text-muted md:block">
              {user.email}
            </span>
          )}
          <button
            onClick={handleLogout}
            title="Sign out"
            className="flex h-7 w-7 items-center justify-center rounded text-text-muted hover:text-text-secondary hover:bg-overlay transition-colors"
          >
            <LogOut size={13} />
          </button>
        </div>
      </header>

      <main className={cn("flex-1", mainClassName ?? "p-5")}>
        {children}
      </main>
    </div>
  )
}
