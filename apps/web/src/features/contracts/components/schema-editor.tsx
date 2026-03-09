import * as React from "react"
import { ChevronDown, GripVertical, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/cn"
import type { SchemaField, FieldType, ContractSchema } from "@repo/types"

const FIELD_TYPES: FieldType[] = [
  "string",
  "number",
  "boolean",
  "object",
  "array",
  "file",
]

interface SchemaEditorProps {
  value: ContractSchema
  onChange: (schema: ContractSchema) => void
  placeholder?: string
  error?: string | null
  invalidRowIndexes?: number[]
  disabled?: boolean
}

export function SchemaEditor({
  value,
  onChange,
  placeholder = "fieldName",
  error,
  invalidRowIndexes = [],
  disabled,
}: SchemaEditorProps) {
  const [draggingIndex, setDraggingIndex] = React.useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null)
  const invalidRows = React.useMemo(() => new Set(invalidRowIndexes), [invalidRowIndexes])

  function addField() {
    const newField: SchemaField = {
      name: "",
      type: "string",
      required: true,
    }
    onChange({ fields: [...value.fields, newField] })
  }

  function updateField(index: number, patch: Partial<SchemaField>) {
    const fields = value.fields.map((f, i) =>
      i === index ? { ...f, ...patch } : f
    )
    onChange({ fields })
  }

  function removeField(index: number) {
    onChange({ fields: value.fields.filter((_, i) => i !== index) })
  }

  function reorderFields(fromIndex: number, toIndex: number) {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= value.fields.length ||
      toIndex >= value.fields.length
    ) {
      return
    }

    const fields = [...value.fields]
    const [moved] = fields.splice(fromIndex, 1)
    if (!moved) return
    fields.splice(toIndex, 0, moved)
    onChange({ fields })
  }

  function handleDragStart(index: number, event: React.DragEvent<HTMLButtonElement>) {
    if (disabled) return
    setDraggingIndex(index)
    setDragOverIndex(index)
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", String(index))
  }

  function handleDragOver(index: number, event: React.DragEvent<HTMLDivElement>) {
    if (disabled || draggingIndex === null) return
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    if (dragOverIndex !== index) {
      setDragOverIndex(index)
    }
  }

  function handleDrop(index: number, event: React.DragEvent<HTMLDivElement>) {
    if (disabled) return
    event.preventDefault()

    const fallbackIndex = Number.parseInt(event.dataTransfer.getData("text/plain"), 10)
    const sourceIndex = draggingIndex ?? (Number.isInteger(fallbackIndex) ? fallbackIndex : null)

    if (sourceIndex !== null) {
      reorderFields(sourceIndex, index)
    }

    setDraggingIndex(null)
    setDragOverIndex(null)
  }

  function handleDragEnd() {
    setDraggingIndex(null)
    setDragOverIndex(null)
  }

  return (
    <section className={cn(
      "overflow-hidden rounded-md border bg-surface shadow-brutal-sm",
      error ? "border-error/40" : "border-border-subtle"
    )}>
      {value.fields.length === 0 ? (
        <div className="border border-transparent bg-surface/40 px-4 py-6 text-center">
          {!disabled && (
            <button
              type="button"
              onClick={addField}
              className="font-mono text-xs font-medium text-text-secondary underline transition-all hover:text-text-primary hover:no-underline"
            >
              + Add row
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[28px_minmax(0,1fr)_96px_84px] gap-x-1.5 gap-y-2 border-b border-border-subtle bg-elevated px-3 py-2">
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">
              
            </span>
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">
              Field path
            </span>
            <span className="font-mono text-center text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">
              Type
            </span>
            <span className="font-mono text-center text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">
              Required
            </span>
          </div>

          {value.fields.map((field, i) => (
            <div
              key={i}
              className={cn(
                "grid grid-cols-[28px_minmax(0,1fr)_96px_84px] gap-x-1.5 gap-y-2 items-center px-3 py-2 transition-colors",
                invalidRows.has(i) && "bg-error/6 ring-1 ring-inset ring-error/20",
                i < value.fields.length - 1 && "border-b border-text-muted/30",
                draggingIndex === i && "opacity-40",
                dragOverIndex === i && draggingIndex !== null && draggingIndex !== i && "bg-overlay"
              )}
              onDragOver={(e) => handleDragOver(i, e)}
              onDrop={(e) => handleDrop(i, e)}
            >
              <button
                type="button"
                draggable
                onDragStart={(e) => handleDragStart(i, e)}
                onDragEnd={handleDragEnd}
                title="Drag to reorder"
                className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-overlay hover:text-text-primary cursor-grab active:cursor-grabbing"
              >
                <GripVertical size={12} />
              </button>

              {/* Name */}
                <input
                  type="text"
                  value={field.name}
                  onChange={(e) => updateField(i, { name: e.target.value })}
                  placeholder={placeholder}
                  disabled={disabled}
                  className={cn(
                    "h-8 w-full rounded-md bg-transparent px-2 font-mono text-xs text-text-primary placeholder:text-text-muted transition-colors focus:bg-elevated focus:outline-none disabled:opacity-60",
                    invalidRows.has(i) && "text-error placeholder:text-error/60"
                  )}
                />

              {/* Type */}
              <div className="flex justify-center">
                <div className="relative w-[78px]">
                <select
                  value={field.type}
                  onChange={(e) =>
                    updateField(i, { type: e.target.value as FieldType })
                  }
                  disabled={disabled}
                  className={cn(
                    "h-8 w-full appearance-none rounded-md bg-transparent pl-1.5 pr-5 font-mono text-left text-xs font-medium text-text-secondary transition-colors focus:bg-elevated focus:outline-none disabled:opacity-60",
                    invalidRows.has(i) && "text-error"
                  )}
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <ChevronDown className={cn(
                  "pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-text-muted",
                  invalidRows.has(i) && "text-error/70"
                )} />
                </div>
              </div>

              {/* Required toggle */}
              <div className="flex items-center justify-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    !disabled && updateField(i, { required: !field.required })
                  }
                  className={cn(
                    "rounded-md border px-2 py-1 font-mono text-[9px] font-medium uppercase tracking-[0.12em] leading-none transition-colors",
                    invalidRows.has(i) && "border-error/40 text-error",
                    field.required
                      ? "border-success/25 bg-success/12 text-success hover:border-success/40 hover:bg-success/18"
                      : "border-warning/20 bg-warning/10 text-warning hover:border-warning/35 hover:bg-warning/14"
                  )}
                  disabled={disabled}
                >
                  {field.required ? "yes" : "no"}
                </button>

                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeField(i)}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-overlay hover:text-error"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {!disabled && (
            <div className="flex justify-center border-t border-border-subtle/60 px-3 py-2">
              <button
                type="button"
                onClick={addField}
                className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle px-3 py-1.5 font-mono text-xs font-medium text-text-secondary transition-colors hover:border-border-default hover:bg-overlay hover:text-text-primary"
              >
                <Plus size={11} />
                Add row
              </button>
            </div>
          )}

        </>
      )}

      {error ? (
        <div className="border-t border-error/20 bg-error/8 px-3 py-2 text-xs text-error">
          {error}
        </div>
      ) : null}
    </section>
  )
}
