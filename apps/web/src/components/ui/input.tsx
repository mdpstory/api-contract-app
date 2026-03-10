import * as React from "react"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface InputProps extends React.ComponentProps<"input"> {
  label?: string
  error?: string
}

function Input({ className, type, label, error, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-")

  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <Label htmlFor={inputId} className="text-xs text-text-secondary">
          {label}
        </Label>
      ) : null}
      <input
        id={inputId}
        type={type}
        data-slot="input"
        aria-invalid={error ? true : undefined}
        className={cn(
          "h-8 w-full min-w-0 rounded-none border border-input bg-transparent px-2.5 py-1 text-xs transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 md:text-xs dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className
        )}
        {...props}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

export { Input }
