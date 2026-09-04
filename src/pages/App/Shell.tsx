import type { ReactNode } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import { CalendarDays, LineChart, LogOut, ShoppingBag } from "lucide-react"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"

/**
 * Shell de la versión "app" del panel: pantalla completa y barra de pestañas
 * abajo, donde llega el pulgar. Es la interfaz que usan los barberos desde su
 * celular y el dueño para gestionar el negocio fuera de la tablet del local.
 *
 * Mismo lenguaje visual del sitio (negro/beige, Archivo extendida), pero con
 * las proporciones de una app: nada de sidebar fija ni tablas anchas.
 */
export default function AppMovilShell({ children }: { children: ReactNode }) {
  const { role, barbero, signOut } = useAuth()
  const navigate = useNavigate()
  const esDueno = role === "superadmin" || role === "staff"

  const TABS = [
    { to: "/app", label: "Agenda", icon: CalendarDays, end: true },
    { to: "/app/vender", label: "Vender", icon: ShoppingBag, end: false },
    ...(role === "superadmin" ? [{ to: "/app/control", label: "Control", icon: LineChart, end: false }] : []),
  ]

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-sidebar px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-sidebar-foreground">
        <div>
          <div className="brand-display text-[17px] leading-none text-sidebar-primary">
            Cieza Barber<span className="text-sidebar-foreground/60">.</span>
          </div>
          <div className="brand-serif mt-1 text-[12px] text-sidebar-foreground/70">
            {barbero ? `Agenda de ${barbero}` : esDueno ? "Panel del estudio" : "Panel"}
          </div>
        </div>
        <button
          onClick={async () => {
            await signOut()
            navigate("/")
          }}
          aria-label="Cerrar sesión"
          className="flex size-11 items-center justify-center text-sidebar-foreground/80 transition-colors hover:text-sidebar-primary"
        >
          <LogOut className="size-4" />
        </button>
      </header>

      {/* pb: deja aire para que la barra de pestañas no tape el contenido. */}
      <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center gap-1 py-3 text-muted-foreground transition-colors",
                isActive && "text-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="size-5" strokeWidth={isActive ? 2.4 : 1.8} />
                <span className="brand-wide text-[10px]">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
