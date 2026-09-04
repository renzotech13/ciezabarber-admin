import type { ReactNode } from "react"
import { NavLink } from "react-router-dom"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { NuevaReservaWatcher } from "@/components/NuevaReservaWatcher"

const NAV_ITEMS = [
  { to: "/reservas", label: "Reservas" },
  { to: "/conversaciones", label: "Conversaciones" },
  { to: "/disponibilidad", label: "Disponibilidad" },
  { to: "/servicios", label: "Servicios" },
  { to: "/productos", label: "Productos" },
  { to: "/multimedia", label: "Multimedia" },
]

/**
 * El plano oscuro del sitio (footer/hero) llevado al panel: sidebar negra con
 * la tipografía extendida de la marca y el patrón de selección del sitio — el
 * item activo se invierte a beige, igual que los .on del modal de reserva.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const { session, role, signOut } = useAuth()

  return (
    <div className="flex min-h-svh bg-background">
      {/* Sin salida visual propia: vive acá para verse desde cualquier
          página del panel, no solo Reservas. */}
      <NuevaReservaWatcher />
      <aside className="flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="border-b border-sidebar-border px-5 pb-5 pt-6">
          <div className="brand-display text-[22px] leading-[0.94] text-sidebar-primary">
            Cieza
            <br />
            Barber<span className="text-sidebar-foreground/60">.</span>
          </div>
          <div className="brand-serif mt-2 text-[13px] text-sidebar-foreground/70">Panel del estudio</div>
        </div>

        <nav className="flex flex-1 flex-col py-3">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "brand-wide border-b border-sidebar-border/60 px-5 pb-[13px] pt-[15px] text-[12px] text-sidebar-foreground/85 transition-colors",
                  "hover:bg-sidebar-foreground/10 hover:text-sidebar-primary",
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )
              }
            >
              {label}
            </NavLink>
          ))}

          {role === "superadmin" && (
            <NavLink
              to="/control"
              className={({ isActive }) =>
                cn(
                  "brand-wide mt-6 flex items-center justify-between border-y border-sidebar-border/60 px-5 pb-[13px] pt-[15px] text-[12px] text-sidebar-foreground/85 transition-colors",
                  "hover:bg-sidebar-foreground/10 hover:text-sidebar-primary",
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )
              }
            >
              Control
              <span className="brand-serif text-[11px] normal-case tracking-normal opacity-60">solo dueño</span>
            </NavLink>
          )}
        </nav>

        <div className="border-t border-sidebar-border px-5 py-4">
          <div className="brand-serif mb-2 truncate text-[12px] text-sidebar-foreground/60">{session?.user.email}</div>
          <button
            onClick={() => signOut()}
            className="brand-wide text-[11px] text-sidebar-foreground/85 underline-offset-4 transition-colors hover:text-sidebar-primary hover:underline"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-auto">{children}</main>
    </div>
  )
}
