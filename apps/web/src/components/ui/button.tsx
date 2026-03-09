import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/cn"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-all cursor-pointer select-none disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-1 focus-visible:ring-offset-base",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-text-primary text-ink hover:bg-accent-hover active:scale-[0.98]",
        secondary:
          "bg-elevated text-text-primary border border-border-default hover:bg-overlay hover:border-border-strong active:scale-[0.98]",
        ghost:
          "text-text-secondary hover:text-text-primary hover:bg-overlay active:scale-[0.98]",
        destructive:
          "bg-error/10 text-error border border-error/25 hover:bg-error/18 hover:border-error/40 active:scale-[0.98]",
        outline:
          "border border-border-default text-text-secondary hover:text-text-primary hover:bg-overlay hover:border-border-strong active:scale-[0.98]",
      },
      size: {
        sm:      "h-7 px-2.5 text-xs rounded",
        md:      "h-8 px-3.5 text-sm",
        lg:      "h-9 px-5 text-sm",
        icon:    "h-8 w-8 p-0 rounded",
        "icon-sm": "h-6 w-6 p-0 rounded text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
