import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  formatSchemaJsoncShape,
  formatSchemaTypedShape,
} from "@/features/contracts/lib/schema-preview"
import { cn } from "@/lib/cn"
import type { ContractSchema } from "@repo/types"

export type PreviewMode = "typescript" | "jsonc"

interface SchemaLivePreviewProps {
  label: string
  schema: ContractSchema
  emptyMessage?: string
  mode: PreviewMode
  onModeChange: (mode: PreviewMode) => void
}

const TYPE_TOKENS = new Set(["string", "number", "boolean", "object", "array", "file"])

function renderValueToken(value: string, mode: PreviewMode) {
  if (!value) return null

  const trimmed = value.trim()
  const trailingComma = trimmed.endsWith(",") ? "," : ""
  const base = trailingComma ? trimmed.slice(0, -1) : trimmed

  if (base === "{" || base === "}" || base === "[]") {
    return (
      <span className="text-text-secondary">
        {base}
        {trailingComma}
      </span>
    )
  }

  if (mode === "typescript" && TYPE_TOKENS.has(base)) {
    return (
      <span className="text-accent">
        {base}
        {trailingComma}
      </span>
    )
  }

  if (/^".*"$/.test(base)) {
    return (
      <span className="text-success">
        {base}
        {trailingComma}
      </span>
    )
  }

  if (/^-?\d+(\.\d+)?$/.test(base)) {
    return (
      <span className="text-warning">
        {base}
        {trailingComma}
      </span>
    )
  }

  if (base === "true" || base === "false") {
    return (
      <span className="text-info">
        {base}
        {trailingComma}
      </span>
    )
  }

  return (
    <span>
      {base}
      {trailingComma}
    </span>
  )
}

function renderTypeScriptLine(line: string, index: number) {
  const braceLine = line.match(/^(\s*)([{}][,]?)$/)
  if (braceLine) {
    return (
      <div key={index}>
        {braceLine[1]}
        <span className="text-text-secondary">{braceLine[2]}</span>
      </div>
    )
  }

  const match = line.match(/^(\s*)([A-Za-z0-9_]+)(\??:)(\s*)(.*)$/)
  if (!match) return <div key={index}>{line}</div>

  const [, indent, key, optionalMarker, spacing, value] = match

  return (
    <div key={index}>
      {indent}
      <span className="text-info">{key}</span>
      <span className="text-text-secondary">{optionalMarker}</span>
      {spacing}
      {renderValueToken(value, "typescript")}
    </div>
  )
}

function renderJsoncLine(line: string, index: number) {
  const commentIndex = line.indexOf("//")
  const code = commentIndex >= 0 ? line.slice(0, commentIndex).replace(/\s+$/, "") : line
  const comment = commentIndex >= 0 ? line.slice(commentIndex) : ""

  const braceLine = code.match(/^(\s*)([{}][,]?)$/)
  if (braceLine) {
    return (
      <div key={index}>
        {braceLine[1]}
        <span className="text-text-secondary">{braceLine[2]}</span>
        {comment ? <span className="text-text-muted"> {comment}</span> : null}
      </div>
    )
  }

  const match = code.match(/^(\s*)("[^"]+")(\s*:\s*)(.*)$/)
  if (!match) {
    return (
      <div key={index}>
        {code}
        {comment ? <span className="text-text-muted"> {comment}</span> : null}
      </div>
    )
  }

  const [, indent, key, separator, value] = match

  return (
    <div key={index}>
      {indent}
      <span className="text-info">{key}</span>
      <span className="text-text-secondary">{separator}</span>
      {renderValueToken(value, "jsonc")}
      {comment ? <span className="text-text-muted"> {comment}</span> : null}
    </div>
  )
}

function renderHighlightedPreview(preview: string, mode: PreviewMode) {
  const lines = preview.split("\n")

  return lines.map((line, index) =>
    mode === "typescript"
      ? renderTypeScriptLine(line, index)
      : renderJsoncLine(line, index)
  )
}

export function SchemaLivePreview({
  label,
  schema,
  emptyMessage = "Add fields to generate a live preview",
  mode,
  onModeChange,
}: SchemaLivePreviewProps) {
  const preview = mode === "typescript"
    ? formatSchemaTypedShape(schema)
    : formatSchemaJsoncShape(schema)

  return (
    <section className="overflow-hidden rounded-md border border-border-subtle bg-surface shadow-brutal-sm">
      <div className="flex min-h-[33px] items-center border-b border-border-subtle bg-elevated px-3 py-2">
        <span className="text-[10px] font-medium uppercase leading-none tracking-[0.12em] text-text-muted">
          {label}
        </span>
      </div>

      <Tabs value={mode} onValueChange={(value) => onModeChange(value as PreviewMode)}>
        <TabsList className="border-b border-border-subtle bg-base px-3">
          <TabsTrigger value="typescript" className="py-2 text-xs">TypeScript</TabsTrigger>
          <TabsTrigger value="jsonc" className="py-2 text-xs">JSONC</TabsTrigger>
        </TabsList>

        <TabsContent value={mode} className="pt-0">
          {schema.fields.length > 0 ? (
            <pre className={cn(
              "min-h-[146px] max-w-full overflow-x-auto bg-ink p-4 font-mono text-xs leading-relaxed text-text-primary",
              "[&>div]:whitespace-pre"
            )}>
              {renderHighlightedPreview(preview, mode)}
            </pre>
          ) : (
            <div className="min-h-[146px] bg-base px-4 py-5 font-mono text-xs tracking-wide text-text-muted">
              {emptyMessage}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </section>
  )
}
