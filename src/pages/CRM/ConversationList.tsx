import { Bot, UserRound } from "lucide-react"
import { ETIQUETA_CLASSES, type ConversacionResumen, type Etiqueta } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { esperaRespuesta } from "./utils"

/** "hace 5 min", "14:30", "12 ago" — según qué tan vieja sea la actividad. */
function tiempoRelativo(iso: string): string {
  const fecha = new Date(iso)
  const minutos = Math.floor((Date.now() - fecha.getTime()) / 60_000)
  if (minutos < 1) return "ahora"
  if (minutos < 60) return `${minutos} min`
  const hoy = new Date().toDateString() === fecha.toDateString()
  if (hoy) return fecha.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })
  return fecha.toLocaleDateString("es-PE", { day: "numeric", month: "short" })
}

export default function ConversationList({
  conversaciones,
  etiquetasPorCliente,
  seleccionadaId,
  onSeleccionar,
  loading,
}: {
  conversaciones: ConversacionResumen[]
  etiquetasPorCliente: Map<string, Etiqueta[]>
  seleccionadaId: string | null
  onSeleccionar: (id: string) => void
  loading: boolean
}) {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-border lg:w-80">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : conversaciones.length === 0 ? (
          <p className="px-5 py-16 text-center text-sm text-muted-foreground">No hay conversaciones en este filtro.</p>
        ) : (
          <ul>
            {conversaciones.map((c) => {
              const activa = c.id === seleccionadaId
              const pendiente = esperaRespuesta(c)
              const etiquetas = etiquetasPorCliente.get(c.cliente_id) ?? []

              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSeleccionar(c.id)}
                    className={cn(
                      "w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent/60",
                      activa && "bg-accent",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {c.cliente_nombre?.trim() || c.cliente_telefono}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{tiempoRelativo(c.actividad_at)}</span>
                    </div>

                    <div className="mt-1 flex items-center gap-1.5">
                      {c.estado === "escalada" ? (
                        <UserRound className="size-3 shrink-0 text-amber-600" aria-label="Atendida por una persona" />
                      ) : (
                        <Bot className="size-3 shrink-0 text-muted-foreground" aria-label="Atendida por el bot" />
                      )}
                      <p
                        className={cn(
                          "truncate text-xs",
                          pendiente ? "font-medium text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {c.ultimo_contenido ?? "Sin mensajes"}
                      </p>
                      {pendiente && <span className="ml-auto size-2 shrink-0 rounded-full bg-primary" />}
                    </div>

                    {etiquetas.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {etiquetas.slice(0, 3).map((e) => (
                          <span
                            key={e.id}
                            className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", ETIQUETA_CLASSES[e.color])}
                          >
                            {e.nombre}
                          </span>
                        ))}
                        {etiquetas.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{etiquetas.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
