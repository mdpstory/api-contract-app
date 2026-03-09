import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/cn"

export const Tabs = TabsPrimitive.Root

export function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "flex items-center gap-0.5 border-b border-border-subtle",
        className
      )}
      {...props}
    />
  )
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "px-3.5 py-2 text-sm font-medium text-text-muted",
        "border-b-2 border-transparent -mb-px transition-colors",
        "hover:text-text-secondary",
        "data-[state=active]:text-text-primary data-[state=active]:border-accent",
        "focus-visible:outline-none focus-visible:text-text-primary",
        className
      )}
      {...props}
    />
  )
}

export function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("pt-5", className)}
      {...props}
    />
  )
}
