import type { ReactNode } from "react"
import { NavLink } from "react-router-dom"
import {
  CalendarCheck2,
  CalendarClock,
  Images,
  LogOut,
  MessagesSquare,
  ShoppingBag,
  Sparkles,
} from "lucide-react"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { to: "/productos", label: "Productos", icon: ShoppingBag },
  { to: "/servicios", label: "Servicios", icon: Sparkles },
  { to: "/reservas", label: "Reservas", icon: CalendarCheck2 },
  { to: "/disponibilidad", label: "Disponibilidad", icon: CalendarClock },
  { to: "/conversaciones", label: "Conversaciones", icon: MessagesSquare },
  { to: "/multimedia", label: "Multimedia", icon: Images },
]

export default function AppShell({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth()

  return (
    <div className="flex min-h-svh bg-background">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex size-8 items-center justify-center rounded-full bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
            C
          </div>
          <div>
            <div className="text-sm font-semibold">Panel Cieza Barber</div>
            <div className="text-xs text-muted-foreground">Administración</div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-sidebar-border px-3 py-3">
          <div className="mb-2 truncate px-2 text-xs text-muted-foreground">{session?.user.email}</div>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => signOut()}>
            <LogOut className="size-4" />
            Cerrar sesión
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-auto">{children}</main>
    </div>
  )
}
