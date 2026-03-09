import * as React from "react"
import { useContractVersions } from "../hooks"
import { formatDateTime, formatRelativeTime } from "@/lib/format"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/cn"
import type { ContractVersion, SchemaDiff, ContractDiff } from "@repo/types"

interface HistoryTabProps {
  projectId: string
  contractId: string
}

export function HistoryTab({ projectId, contractId }: HistoryTabProps) {
  const { data: versions = [], isLoading, isError } = useContractVersions(
    projectId,
    contractId
  )
  const [selected, setSelected] = React.useState<ContractVersion | null>(null)

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-16 rounded-lg bg-surface border border-border-subtle animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-text-secondary">
        <AlertTriangle size={15} className="text-error shrink-0" />
        Could not load history. Please refresh.
      </div>
    )
  }

  if (versions.length === 0) {
    return (
      <p className="text-sm text-text-muted text-center py-12">
        No history yet.
      </p>
    )
  }

  return (
    <>
      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-3 bottom-3 w-px bg-border-subtle" />

        <div className="space-y-0">
          {versions.map((version, i) => (
            <VersionRow
              key={version.id}
              version={version}
              isLatest={i === 0}
              onViewDiff={() => setSelected(version)}
            />
          ))}
        </div>
      </div>

      {/* Diff modal */}
      {selected && (
        <DiffModal
          version={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}

// ─── Version Row ──────────────────────────────────────────────────────────────

function VersionRow({
  version,
  isLatest,
  onViewDiff,
}: {
  version: ContractVersion
  isLatest: boolean
  onViewDiff: () => void
}) {
  return (
    <div className="flex gap-4 pb-6">
      {/* Dot */}
      <div className="relative flex-shrink-0 pt-1">
        <div
            className={cn(
              "relative z-10 h-3.5 w-3.5 rounded-full border",
              isLatest
                ? "border-border-default bg-elevated"
                : "border-border-default bg-base"
            )}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 rounded-md border border-border-subtle bg-surface px-4 py-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-text-muted">
                v{version.version}
              </span>
              {isLatest && (
                <span className="rounded-full border border-border-subtle bg-elevated px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                  latest
                </span>
              )}
            </div>
            <p className="text-sm text-text-primary font-medium leading-snug">
              {version.changeSummary}
            </p>
          </div>
          {version.diff && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewDiff}
              className="shrink-0 text-xs"
            >
              View diff
            </Button>
          )}
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="font-medium text-text-secondary">
            {version.changedByUser?.name ?? version.changedByUser?.email ?? "Unknown"}
          </span>
          <span>·</span>
          <span title={formatDateTime(version.changedAt)}>
            {formatRelativeTime(version.changedAt)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Diff Modal ───────────────────────────────────────────────────────────────

function DiffModal({
  version,
  onClose,
}: {
  version: ContractVersion
  onClose: () => void
}) {
  const diff = version.diff as ContractDiff | null

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            v{version.version - 1} → v{version.version}
          </DialogTitle>
          <p className="text-xs text-text-muted mt-1">
            {version.changedByUser?.name ?? version.changedByUser?.email} ·{" "}
            {formatDateTime(version.changedAt)}
          </p>
        </DialogHeader>

        {!diff ? (
          <p className="text-sm text-text-muted">Initial version — no diff available.</p>
        ) : (
          <div className="space-y-4">
            {/* Meta changes */}
            {(diff.name ?? diff.method ?? diff.path ?? diff.groupId ?? diff.status ?? diff.requestBodyFormat) && (
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
                  General
                </span>
                <div className="rounded-md border border-border-subtle overflow-hidden divide-y divide-border-subtle">
                  {diff.name && (
                    <DiffMetaRow
                      label="Name"
                      from={String(diff.name.from)}
                      to={String(diff.name.to)}
                    />
                  )}
                  {diff.method && (
                    <DiffMetaRow
                      label="Method"
                      from={String(diff.method.from)}
                      to={String(diff.method.to)}
                    />
                  )}
                  {diff.path && (
                    <DiffMetaRow
                      label="Path"
                      from={String(diff.path.from)}
                      to={String(diff.path.to)}
                    />
                  )}
                  {diff.groupId && (
                    <DiffMetaRow
                      label="Group"
                      from={diff.groupId.from ?? "Ungrouped"}
                      to={diff.groupId.to ?? "Ungrouped"}
                    />
                  )}
                  {diff.status && (
                    <DiffMetaRow
                      label="Status"
                      from={String(diff.status.from)}
                      to={String(diff.status.to)}
                    />
                  )}
                  {diff.requestBodyFormat && (
                    <DiffMetaRow
                      label="Request Format"
                      from={String(diff.requestBodyFormat.from)}
                      to={String(diff.requestBodyFormat.to)}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Schema diffs */}
            {diff.request && (
              <SchemaDiffSection label="Request Body" diff={diff.request} />
            )}
            {diff.query && (
              <SchemaDiffSection label="Query" diff={diff.query} />
            )}
            {diff.response && (
              <SchemaDiffSection label="Response" diff={diff.response} />
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 pt-2 border-t border-border-subtle">
                <span className="text-[10px] uppercase tracking-wide text-text-muted">Legend:</span>
              <span className="text-xs diff-add px-1.5 py-0.5 rounded">+ Added</span>
              <span className="text-xs diff-remove px-1.5 py-0.5 rounded">- Removed</span>
              <span className="text-xs diff-change px-1.5 py-0.5 rounded">~ Changed</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DiffMetaRow({
  label,
  from,
  to,
}: {
  label: string
  from: string
  to: string
}) {
  return (
    <div className="grid grid-cols-[80px_1fr_1fr] text-xs">
      <span className="px-3 py-2 text-text-muted bg-elevated font-medium">
        {label}
      </span>
      <span className="px-3 py-2 diff-remove font-mono border-r border-border-subtle">
        {from}
      </span>
      <span className="px-3 py-2 diff-add font-mono">{to}</span>
    </div>
  )
}

function SchemaDiffSection({
  label,
  diff,
}: {
  label: string
  diff: SchemaDiff
}) {
  const hasChanges =
    diff.added.length > 0 ||
    diff.removed.length > 0 ||
    diff.changed.length > 0

  if (!hasChanges) return null

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
        {label}
      </span>
      <div className="rounded-md border border-border-subtle overflow-hidden divide-y divide-border-subtle">
        {diff.added.map((field) => (
          <div key={field} className="flex items-center gap-2 px-3 py-2 diff-add text-xs">
            <span className="font-bold">+</span>
            <span className="font-mono">{field}</span>
            <span className="text-[10px] text-text-muted">added</span>
          </div>
        ))}
        {diff.removed.map((field) => (
          <div key={field} className="flex items-center gap-2 px-3 py-2 diff-remove text-xs">
            <span className="font-bold">-</span>
            <span className="font-mono">{field}</span>
            <span className="text-[10px] text-text-muted">removed</span>
          </div>
        ))}
        {diff.changed.map((entry) => (
          <div key={entry.field} className="flex items-center gap-2 px-3 py-2 diff-change text-xs">
            <span className="font-bold">~</span>
            <span className="font-mono">{entry.field}</span>
            <span className="text-[10px] text-text-muted">changed</span>
          </div>
        ))}
      </div>
    </div>
  )
}
