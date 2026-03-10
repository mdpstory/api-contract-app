import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ModeToggle() {
  const { setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label="Change theme">
          <Sun className="size-[13px] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute size-[13px] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36 rounded-md border border-border bg-popover p-1 shadow-card">
        <DropdownMenuItem className="rounded-sm" onClick={() => setTheme("light") }>
          <Sun className="size-3.5" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem className="rounded-sm" onClick={() => setTheme("dark") }>
          <Moon className="size-3.5" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem className="rounded-sm" onClick={() => setTheme("system") }>
          <Monitor className="size-3.5" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
