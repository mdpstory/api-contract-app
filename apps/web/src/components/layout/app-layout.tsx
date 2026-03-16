import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Zap } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { useMe, useLogout } from "@/features/auth/hooks";
import { cn } from "@/lib/cn";
import { useToast } from "@/lib/toast";
import { SidebarInset, SidebarProvider } from "../ui/sidebar";
import { AppSidebar, type AppSidebarContext } from "./app-sidebar";

interface AppLayoutProps {
  children: React.ReactNode;
  mainClassName?: string;
  sidebar?: AppSidebarContext;
}

export function AppLayout({
  children,
  mainClassName,
  sidebar,
}: AppLayoutProps) {
  const { data: user } = useMe();
  const { mutate: logout } = useLogout();
  const navigate = useNavigate();
  const { toast } = useToast();

  function handleLogout() {
    logout(undefined, {
      onSuccess: () => void navigate({ to: "/auth/login" }),
      onError: () =>
        toast({
          title: "Sign out failed",
          description: "Please try again.",
          variant: "error",
        }),
    });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <SidebarProvider
        style={
          {
            "--sidebar-width": "300px",
          } as React.CSSProperties
        }
      >
        <AppSidebar context={sidebar} />

        <SidebarInset>
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

            {/* Right: user + logout */}
            <div className="ml-auto flex items-center gap-2">
              <ModeToggle />
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
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
