import * as React from "react"
import * as ToastPrimitive from "@radix-ui/react-toast"
import { X, CheckCircle2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/cn"

export const ToastProvider = ToastPrimitive.Provider

export const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      "fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = "ToastViewport"

interface ToastProps extends React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> {
  variant?: "default" | "success" | "error"
}

export const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  ToastProps
>(({ className, variant = "default", ...props }, ref) => (
  <ToastPrimitive.Root
    ref={ref}
    className={cn(
      "flex items-start gap-3 rounded-lg border px-3.5 py-3 shadow-card",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-2",
      "data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-right-2",
      variant === "default" && "bg-elevated border-border-default",
      variant === "success" && "bg-success/8 border-success/20",
      variant === "error"   && "bg-error/8 border-error/20",
      className
    )}
    {...props}
  />
))
Toast.displayName = "Toast"

export function ToastIcon({ variant }: { variant?: "default" | "success" | "error" }) {
  if (variant === "success") {
    return <CheckCircle2 size={15} className="text-success shrink-0 mt-[1px]" />
  }
  if (variant === "error") {
    return <AlertCircle size={15} className="text-error shrink-0 mt-[1px]" />
  }
  return null
}

export const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title
    ref={ref}
    className={cn("text-sm font-medium text-text-primary leading-snug", className)}
    {...props}
  />
))
ToastTitle.displayName = "ToastTitle"

export const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description
    ref={ref}
    className={cn("text-xs text-text-secondary mt-0.5", className)}
    {...props}
  />
))
ToastDescription.displayName = "ToastDescription"

export const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Close
    ref={ref}
    className={cn(
      "text-text-muted hover:text-text-secondary transition-colors shrink-0 rounded p-0.5",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
      className
    )}
    {...props}
  >
    <X size={13} />
  </ToastPrimitive.Close>
))
ToastClose.displayName = "ToastClose"
