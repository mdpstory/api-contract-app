import { cn } from "@/lib/cn"
import { cva, type VariantProps } from "class-variance-authority"

const badgeVariants = cva(
  "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium leading-none",
  {
    variants: {
      variant: {
        draft:    "bg-overlay text-text-secondary border border-border-default",
        approved: "bg-success/10 text-success border border-success/20",
        error:    "bg-error/10 text-error border border-error/20",
        warning:  "bg-warning/10 text-warning border border-warning/20",
        info:     "bg-info/10 text-info border border-info/20",
        accent:   "bg-accent/10 text-accent border border-accent/20",
      },
    },
    defaultVariants: {
      variant: "draft",
    },
  }
)

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}
