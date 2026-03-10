import { cn } from "@/lib/utils"
import { Loader2Icon } from "lucide-react"

function Spinner({ className, size, ...props }: React.ComponentProps<"svg"> & { size?: "sm" | "md" | "lg" }) {
  return (
    <Loader2Icon
      role="status"
      aria-label="Loading"
      className={cn(
        size === "sm" ? "size-3" : size === "lg" ? "size-6" : "size-4",
        "animate-spin",
        className
      )}
      {...props}
    />
  )
}

export { Spinner }
