import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { Play, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { useEnvironments } from "@/features/environments/hooks"
import { runValidation } from "../api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/cn"
import { useToast } from "@/lib/toast"
import type { ContractSchema, ValidationFieldResult, ValidationRunInput } from "@repo/types"

interface ValidateTabProps {
  projectId: string
  contractId: string
  defaultMethod: string
  defaultPath: string
  requestBodyFormat: "json" | "form-data"
  requestSchema: ContractSchema
}

interface HeaderEntry {
  key: string
  value: string
}

export function ValidateTab({
  projectId,
  contractId,
  defaultMethod,
  defaultPath,
  requestBodyFormat,
  requestSchema,
}: ValidateTabProps) {
  const { data: environments = [], isLoading: envsLoading } = useEnvironments(projectId)
  const { toast } = useToast()
  const [url, setUrl] = React.useState(defaultPath)
  const [envId, setEnvId] = React.useState<string>("")
  const [headers, setHeaders] = React.useState<HeaderEntry[]>([
    { key: "", value: "" },
  ])
  const [body, setBody] = React.useState("")
  const [formDataEntries, setFormDataEntries] = React.useState<HeaderEntry[]>([
    { key: "", value: "" },
  ])
  const [bodyError, setBodyError] = React.useState<string | null>(null)
  const hasFileField = React.useMemo(
    () => requestSchema.fields.some((field) => field.type === "file"),
    [requestSchema]
  )

  const hasBody = ["POST", "PUT", "PATCH"].includes(defaultMethod)

  const { mutate: validate, isPending, data: result, reset } = useMutation({
    mutationFn: (input: ValidationRunInput) =>
      runValidation(projectId, contractId, input),
    onError: (err) =>
      toast({ title: "Validation failed", description: err.message, variant: "error" }),
  })

  React.useEffect(() => {
    setUrl(defaultPath)
    setEnvId("")
    setHeaders([{ key: "", value: "" }])
    setBody("")
    setFormDataEntries(
      requestSchema.fields.length > 0
        ? requestSchema.fields
            .filter((field) => field.type !== "object")
            .map((field) => ({ key: field.name, value: "" }))
        : [{ key: "", value: "" }]
    )
    setBodyError(null)
    reset()
  }, [contractId, defaultMethod, defaultPath, requestSchema, reset])

  function handleAddHeader() {
    setHeaders((h) => [...h, { key: "", value: "" }])
  }

  function handleHeaderChange(
    i: number,
    field: "key" | "value",
    val: string
  ) {
    setHeaders((h) => h.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)))
  }

  function handleRemoveHeader(i: number) {
    setHeaders((h) => h.filter((_, idx) => idx !== i))
  }

  function handleAddFormField() {
    setFormDataEntries((items) => [...items, { key: "", value: "" }])
  }

  function handleFormFieldChange(i: number, field: "key" | "value", val: string) {
    setFormDataEntries((items) => items.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)))
  }

  function handleRemoveFormField(i: number) {
    setFormDataEntries((items) => items.filter((_, idx) => idx !== i))
  }

  function handleRun() {
    reset()
    setBodyError(null)

    let parsedBody: unknown = undefined
    if (hasBody && requestBodyFormat === "json" && body.trim()) {
      try {
        parsedBody = JSON.parse(body) as unknown
      } catch {
        setBodyError("Invalid JSON body")
        return
      }
    }

    if (hasBody && requestBodyFormat === "form-data") {
      const formDataBody: Record<string, string> = {}
      for (const entry of formDataEntries) {
        if (!entry.key.trim()) continue
        formDataBody[entry.key.trim()] = entry.value
      }
      parsedBody = Object.keys(formDataBody).length > 0 ? formDataBody : undefined
    }

    const headersMap: Record<string, string> = {}
    for (const h of headers) {
      if (h.key.trim()) headersMap[h.key.trim()] = h.value
    }

    validate({
      url,
      environmentId: envId || undefined,
      headers: Object.keys(headersMap).length > 0 ? headersMap : undefined,
      body: parsedBody,
    })
  }

  const passed = result?.details.filter((d) => d.status === "valid").length ?? 0
  const failed = result?.details.filter((d) => d.status !== "valid").length ?? 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left — Input */}
      <div className="space-y-4">
        {/* URL */}
        <Input
          label="URL"
          placeholder="{{BASE_URL}}/api/endpoint"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />

        {/* Environment */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium tracking-wide text-text-secondary">
            Environment
          </label>
          <select
            value={envId}
            onChange={(e) => setEnvId(e.target.value)}
            disabled={envsLoading}
            className="h-10 rounded-lg border border-border-subtle bg-elevated px-3 text-sm text-text-primary transition-colors focus:border-border-default focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {envsLoading ? (
              <option value="">Loading environments...</option>
            ) : (
              <>
                <option value="">None</option>
                {environments.map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.isGlobal ? "Global" : env.name}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        {/* Headers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
              <span className="text-xs font-medium tracking-wide text-text-secondary">
                Headers
              </span>
            <button
              type="button"
              onClick={handleAddHeader}
              className="text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
            >
              + Add
            </button>
          </div>
          <div className="space-y-1.5">
            {headers.map((h, i) => (
              <div key={i} className="flex gap-2">
                <input
                  placeholder="Key"
                  value={h.key}
                  onChange={(e) => handleHeaderChange(i, "key", e.target.value)}
                  className="h-9 flex-1 rounded-lg border border-border-subtle bg-elevated px-3 text-xs text-text-primary placeholder:text-text-muted transition-colors focus:border-border-default focus:outline-none"
                />
                <input
                  placeholder="Value"
                  value={h.value}
                  onChange={(e) => handleHeaderChange(i, "value", e.target.value)}
                  className="h-9 flex-1 rounded-lg border border-border-subtle bg-elevated px-3 text-xs text-text-primary placeholder:text-text-muted transition-colors focus:border-border-default focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveHeader(i)}
                  className="rounded-md px-2 text-xs text-text-muted transition-colors hover:bg-overlay hover:text-error"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        {hasBody && requestBodyFormat === "json" && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium tracking-wide text-text-secondary">
              Request Body (JSON)
            </label>
            <textarea
              value={body}
              onChange={(e) => { setBody(e.target.value); setBodyError(null) }}
              placeholder='{"key": "value"}'
              className={cn(
                "h-28 w-full resize-none rounded-md border bg-elevated px-3 py-3 font-mono text-xs text-text-primary placeholder:text-text-muted",
                "focus:outline-none transition-colors",
                bodyError
                  ? "border-error focus:border-error"
                  : "border-border-subtle focus:border-border-default"
              )}
            />
            {bodyError && (
              <p className="text-xs text-error">{bodyError}</p>
            )}
          </div>
        )}

        {hasBody && requestBodyFormat === "form-data" && (
          <div className="space-y-2">
            {hasFileField ? (
              <div className="rounded-md border border-warning/20 bg-warning/10 px-3 py-2 font-mono text-xs text-warning">
                File fields are defined in this contract. Validator currently supports text form-data fields only.
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium tracking-wide text-text-secondary">
                Form Data Fields
              </span>
              <button
                type="button"
                onClick={handleAddFormField}
                className="text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
              >
                + Add
              </button>
            </div>
            <div className="space-y-1.5">
              {formDataEntries.map((entry, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    placeholder="Field"
                    value={entry.key}
                    onChange={(e) => handleFormFieldChange(i, "key", e.target.value)}
                    className="h-9 flex-1 rounded-lg border border-border-subtle bg-elevated px-3 font-mono text-xs text-text-primary placeholder:text-text-muted transition-colors focus:border-border-default focus:outline-none"
                  />
                  <input
                    placeholder="Value"
                    value={entry.value}
                    onChange={(e) => handleFormFieldChange(i, "value", e.target.value)}
                    className="h-9 flex-1 rounded-lg border border-border-subtle bg-elevated px-3 font-mono text-xs text-text-primary placeholder:text-text-muted transition-colors focus:border-border-default focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveFormField(i)}
                    className="rounded-md px-2 text-xs text-text-muted transition-colors hover:bg-overlay hover:text-error"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button onClick={handleRun} disabled={isPending || !url} className="w-full">
          <Play size={13} />
          {isPending ? "Running..." : "Run Validation"}
        </Button>
      </div>

      {/* Right — Result */}
      <div className="space-y-4">
        {result ? (
          <>
            {/* Summary */}
            <div
              className={cn(
                "flex items-center gap-3 rounded-md border px-4 py-3.5 shadow-brutal-sm",
                result.result === "passed"
                    ? "border-success/20 bg-success/10"
                    : "border-error/20 bg-error/10"
              )}
            >
              {result.result === "passed" ? (
                <CheckCircle size={16} className="text-success shrink-0" />
              ) : (
                <XCircle size={16} className="text-error shrink-0" />
              )}
              <div>
                <p
                  className={cn(
                    "text-sm font-semibold",
                    result.result === "passed" ? "text-success" : "text-error"
                  )}
                >
                  {result.result === "passed" ? "Validation Passed" : "Validation Failed"}
                </p>
                <p className="text-xs text-text-muted">
                  {passed} passed · {failed} failed
                </p>
              </div>
            </div>

            {/* Field results */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium tracking-wide text-text-muted">
                Field Results
              </span>
              <div className="overflow-hidden rounded-md border border-border-subtle divide-y divide-border-subtle bg-surface shadow-brutal-sm">
                {result.details.map((d) => (
                  <FieldResultRow key={d.field} result={d} />
                ))}
                {result.details.length === 0 && (
                  <p className="text-xs text-text-muted px-3 py-3 text-center">
                    No fields to validate
                  </p>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border-default bg-surface/40 text-center">
            <AlertCircle size={24} className="text-text-muted" />
            <p className="text-sm text-text-secondary">
              Run a validation to see results
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function FieldResultRow({ result }: { result: ValidationFieldResult }) {
  const isValid = result.status === "valid"
  const isMissing = result.status === "missing"

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 text-xs",
        isValid ? "bg-success/5" : "bg-error/5"
      )}
    >
      {isValid ? (
        <CheckCircle size={12} className="text-success shrink-0" />
      ) : (
        <XCircle size={12} className="text-error shrink-0" />
      )}
      <span className="font-mono font-medium text-text-primary flex-1">
        {result.field}
      </span>
      <span className="text-text-muted">{result.expected}</span>
      {isMissing ? (
        <span className="text-error">missing</span>
      ) : result.message ? (
        <span className="text-error truncate max-w-[140px]">{result.message}</span>
      ) : (
        <span className="text-text-secondary">ok</span>
      )}
    </div>
  )
}
