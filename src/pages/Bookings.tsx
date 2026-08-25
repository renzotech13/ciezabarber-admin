import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { actualizarEstadoCita as actualizarEstadoCitaBot, BotApiError } from "@/lib/botApi"
import { CITA_ESTADO_LABEL, type Cita, type CitaEstado } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown } from "lucide-react"

/** Cita + los datos del cliente y servicio que trae el join de Supabase. */
type CitaConDetalle = Cita & {
  clientes: { nombre: string | null; telefono: string }
  services: { name: string }
}

const ESTADO_ORDER: CitaEstado[] = ["confirmada", "completada", "no_asistio", "cancelada"]
const FILTROS: { key: "all" | CitaEstado; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "confirmada", label: "Confirmadas" },
  { key: "completada", label: "Completadas" },
  { key: "no_asistio", label: "No asistió" },
  { key: "cancelada", label: "Canceladas" },
]

function formatDateTime(iso: string) {
  const fecha = new Date(iso)
  return {
    fecha: fecha.toLocaleDateString("es-PE", { weekday: "short", day: "numeric", month: "short" }),
    hora: fecha.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }),
  }
}

// Los tokens de color existentes quedaron nombrados por el enum viejo de
// 'bookings' (pending/confirmed/cancelled/completed) — se reutilizan por
// significado en vez de duplicar tokens de CSS para el enum de citas.
const ESTADO_COLOR_TOKEN: Record<CitaEstado, string> = {
  confirmada: "confirmed",
  completada: "completed",
  cancelada: "cancelled",
  no_asistio: "pending",
}

function StatusBadge({ estado }: { estado: CitaEstado }) {
  const token = ESTADO_COLOR_TOKEN[estado]
  return (
    <Badge
      variant="outline"
      className="border-transparent"
      style={{
        color: `var(--status-${token})`,
        backgroundColor: `var(--status-${token}-bg)`,
      }}
    >
      {CITA_ESTADO_LABEL[estado]}
    </Badge>
  )
}

export default function Bookings() {
  const [citas, setCitas] = useState<CitaConDetalle[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | CitaEstado>("all")

  useEffect(() => {
    let active = true

    async function load() {
      // Fuente única: citas (WhatsApp y la reserva web escriben acá desde
      // que reserva.html pasó a agendar vía el bot en vez de una tabla
      // 'bookings' aparte sin validación de horario real.
      const { data, error } = await supabase
        .from("citas")
        .select("*, clientes!inner(nombre, telefono), services!inner(name)")
        .order("inicio_utc", { ascending: true })
      if (!active) return
      if (error) {
        toast.error("No se pudieron cargar las reservas.")
      } else {
        setCitas(data as CitaConDetalle[])
      }
      setLoading(false)
    }
    load()

    const channel = supabase
      .channel("citas-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "citas" }, () => {
        load()
      })
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [])

  async function updateStatus(id: string, estado: CitaEstado) {
    const previous = citas
    setCitas((rows) => rows.map((c) => (c.id === id ? { ...c, estado } : c)))
    try {
      // Vía el bot, no un update directo: si se cancela, el bot también
      // borra el evento de Calendar — un update directo a Supabase dejaba
      // el evento huérfano.
      await actualizarEstadoCitaBot(id, estado)
      toast.success(`Cita marcada como ${CITA_ESTADO_LABEL[estado].toLowerCase()}.`)
    } catch (err) {
      setCitas(previous)
      toast.error(err instanceof BotApiError ? err.message : "No se pudo actualizar el estado.")
    }
  }

  const filtered = useMemo(
    () => (filter === "all" ? citas : citas.filter((c) => c.estado === filter)),
    [citas, filter],
  )

  const confirmadasCount = citas.filter((c) => c.estado === "confirmada").length

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reservas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? "Cargando…"
              : `${confirmadasCount} cita${confirmadasCount === 1 ? "" : "s"} confirmada${confirmadasCount === 1 ? "" : "s"}, de WhatsApp y la web.`}
          </p>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mb-4">
        <TabsList>
          {FILTROS.map((f) => (
            <TabsTrigger key={f.key} value={f.key}>
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {loading ? (
          <div className="flex flex-col gap-3 p-5">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">
            No hay reservas en esta categoría todavía.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha y hora</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const { fecha, hora } = formatDateTime(c.inicio_utc)
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="whitespace-nowrap font-medium capitalize">
                        {fecha} · {hora}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{c.clientes.nombre?.trim() || "Sin nombre"}</div>
                        <a
                          href={`https://wa.me/${c.clientes.telefono}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-muted-foreground hover:text-primary"
                        >
                          {c.clientes.telefono}
                        </a>
                      </TableCell>
                      <TableCell className="max-w-56">
                        <span className="text-sm">{c.services.name}</span>
                        {c.notas && <div className="mt-0.5 text-xs text-muted-foreground">{c.notas}</div>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.creada_por === "bot" ? "WhatsApp" : "Web / manual"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge estado={c.estado} />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent">
                            Cambiar estado
                            <ChevronDown className="size-3.5" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {ESTADO_ORDER.map((estado) => (
                              <DropdownMenuItem
                                key={estado}
                                disabled={estado === c.estado}
                                onClick={() => updateStatus(c.id, estado)}
                              >
                                {CITA_ESTADO_LABEL[estado]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
