import * as React from "react"
import { Plus, X } from "lucide-react"
import { cn } from "@/lib/cn"
import type { HttpMethod } from "@repo/types"

// ─── Types ────────────────────────────────────────────────────────────────────

export type RequestTab =
  | { kind: "contract"; id: string; contractId: string; label: string; method: HttpMethod }
  | { kind: "blank"; id: string; label: string }

// ─── Method badge colors (text only, dark-bg friendly) ────────────────────────

const METHOD_TEXT: Record<HttpMethod, string> = {
  GET: "text-emerald-400",
  POST: "text-sky-400",
  PUT: "text-amber-400",
  PATCH: "text-violet-400",
  DELETE: "text-rose-400",
}

// ─── TabBar ───────────────────────────────────────────────────────────────────

interface TabBarProps {
  tabs: RequestTab[]
  activeTabId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNew: () => void
}

export function TabBar({ tabs, activeTabId, onSelect, onClose, onNew }: TabBarProps) {
  return (
    <div className="flex items-center border-b border-border-subtle bg-surface overflow-x-auto scrollbar-none">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId
        return (
          <div
            key={tab.id}
            className={cn(
              "group relative flex shrink-0 items-center gap-1.5 border-r border-border-subtle px-3 py-2.5 cursor-pointer select-none transition-colors",
              isActive
                ? "bg-elevated text-text-primary"
                : "text-text-muted hover:bg-overlay/60 hover:text-text-secondary",
            )}
            onClick={() => onSelect(tab.id)}
          >
            {tab.kind === "contract" && (
              <span className={cn(
                "shrink-0 font-mono text-[9px] font-bold uppercase tracking-wide transition-colors",
                isActive ? METHOD_TEXT[tab.method] : "text-text-muted"
              )}>
                {tab.method}
              </span>
            )}
            <span className="max-w-[160px] truncate font-mono text-[11px]">
              {tab.label}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onClose(tab.id)
              }}
              className={cn(
                "ml-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded transition-all",
                isActive
                  ? "text-text-muted hover:bg-overlay hover:text-text-primary opacity-100"
                  : "opacity-0 group-hover:opacity-100 hover:bg-overlay hover:text-text-primary"
              )}
              title="Close tab"
            >
              <X size={10} />
            </button>
            {/* Active indicator line at bottom */}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent" />
            )}
          </div>
        )
      })}

      {/* New tab button */}
      <button
        type="button"
        onClick={onNew}
        title="New tab"
        className="flex h-full shrink-0 items-center justify-center px-3 py-2.5 text-text-muted transition-colors hover:bg-overlay/60 hover:text-text-secondary"
      >
        <Plus size={13} />
      </button>
    </div>
  )
}
