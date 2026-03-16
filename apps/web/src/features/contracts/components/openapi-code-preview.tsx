import * as React from "react"
import { createHighlighter, type Highlighter } from "shiki"
import { Copy, Check, Download } from "lucide-react"
import { cn } from "@/lib/cn"
import { useToast } from "@/lib/toast"
import {
  generateOpenApiObject,
  toJson,
  toYaml,
  type ContractOpenApiInput,
} from "../lib/openapi-gen"

// ─── Shiki singleton ──────────────────────────────────────────────────────────

let highlighterPromise: Promise<Highlighter> | null = null

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["vitesse-dark"],
      langs: ["json", "yaml"],
    })
  }
  return highlighterPromise
}

// ─── Types ────────────────────────────────────────────────────────────────────

type CodeFormat = "json" | "yaml"

interface OpenApiCodePreviewProps extends ContractOpenApiInput {
  className?: string
  /** When provided, skips per-contract generation and uses this object directly */
  overrideObj?: Record<string, unknown>
  /** Used for the exported filename — e.g. "GET-user" */
  exportFilename?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OpenApiCodePreview(props: OpenApiCodePreviewProps) {
  const { className, overrideObj, exportFilename, ...input } = props
  const { toast } = useToast()

  const [format, setFormat] = React.useState<CodeFormat>("json")
  const [highlighter, setHighlighter] = React.useState<Highlighter | null>(null)
  const [copied, setCopied] = React.useState(false)
  const copyTimeoutRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    getHighlighter().then(setHighlighter)
    return () => {
      if (copyTimeoutRef.current !== null) window.clearTimeout(copyTimeoutRef.current)
    }
  }, [])

  const code = React.useMemo(() => {
    const obj = overrideObj ?? generateOpenApiObject(input)
    return format === "json" ? toJson(obj) : toYaml(obj)
  }, [
    overrideObj,
    input.method, input.path, input.querySchema, input.parametersSchema,
    input.headersSchema, input.authSchema, input.requestBodyFormat,
    input.requestSchema, input.responseSchema, format,
  ])

  const highlightedHtml = React.useMemo(() => {
    if (!highlighter) return null
    try {
      return highlighter.codeToHtml(code, { lang: format, theme: "vitesse-dark" })
    } catch {
      return null
    }
  }, [highlighter, code, format])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      toast({ title: `${format.toUpperCase()} copied`, variant: "success" })
      if (copyTimeoutRef.current !== null) window.clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = window.setTimeout(() => { setCopied(false) }, 1200)
    } catch {
      toast({ title: "Could not copy", variant: "error" })
    }
  }

  function handleExport() {
    const base = exportFilename ?? "openapi"
    const filename = `${base}.${format}`
    const mime = format === "json" ? "application/json" : "text/yaml"
    const blob = new Blob([code], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: `Exported ${filename}`, variant: "success" })
  }

  return (
    <div className={cn("overflow-hidden rounded-md border border-border-subtle bg-surface shadow-brutal-sm", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle bg-elevated px-3 py-2">
        {/* Left: format toggle */}
        <div className="flex items-center gap-0 border border-border-subtle rounded-md overflow-hidden">
          {(["json", "yaml"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={cn(
                "px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em] transition-colors",
                format === f
                  ? "bg-accent/15 text-accent"
                  : "text-text-muted hover:text-text-secondary hover:bg-overlay",
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Right: copy + export */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 rounded px-2 py-1 font-mono text-[10px] font-medium text-text-muted transition-colors hover:text-text-primary hover:bg-overlay"
          >
            {copied ? <Check size={11} className="text-success" /> : <Copy size={11} />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1 rounded px-2 py-1 font-mono text-[10px] font-medium text-text-muted transition-colors hover:text-text-primary hover:bg-overlay"
          >
            <Download size={11} />
            Export
          </button>
        </div>
      </div>

      {/* Code area */}
      <div className="relative">
        {/* Hidden pre drives the container height */}
        <pre
          aria-hidden
          className="invisible block min-h-[320px] w-full whitespace-pre-wrap break-all p-4 font-mono text-xs leading-5"
        >
          {code + "\n"}
        </pre>

        {/* Syntax-highlighted layer */}
        {highlightedHtml ? (
          <div
            className="absolute inset-0 overflow-hidden [&>pre]:!m-0 [&>pre]:!bg-transparent [&>pre]:p-4 [&>pre]:font-mono [&>pre]:text-xs [&>pre]:leading-5 [&>pre]:whitespace-pre-wrap [&>pre]:break-all"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: shiki output is safe
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : (
          <pre className="absolute inset-0 p-4 font-mono text-xs leading-5 text-text-secondary whitespace-pre-wrap break-all">
            {code}
          </pre>
        )}
      </div>
    </div>
  )
}
