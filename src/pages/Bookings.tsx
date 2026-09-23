import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { actualizarEstadoCita as actualizarEstadoCitaBot, BotApiError } from "@/lib/botApi"
import {
  BARBEROS,
  CITA_ESTADO_LABEL,
  COMPROBANTE_ESTADO_LABEL,
  type Barbero,
  METODO_PAGO_LABEL,
  type Cita,
  type CitaEstado,
  type MetodoPago,
} from "@/lib/types"
import FichaReserva from "@/components/FichaReserva"
import { formatoSoles, precioNumerico } from "@/pages/Control/rango"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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
import {
  CalendarCheck2,
  CalendarX2,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  LayoutList,
  Plus,
  Scissors,
  UserRound,
  UserX,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import NuevaCitaDialog from "@/components/NuevaCitaDialog"
import CobroDialog from "@/components/CobroDialog"

/** Cita + los datos del cliente y servicio que trae el join de Supabase. */
type CitaConDetalle = Cita & {
  clientes: { nombre: string | null; telefono: string }
  services: { name: string; price: string }
}

// "expirada" no está en el menú de cambio de estado: la pone el bot al
// liberar un horario sin pago, no es algo que el staff marque a mano.
const ESTADO_ORDER: CitaEstado[] = ["confirmada", "completada", "no_asistio", "cancelada"]
const FILTROS: { key: "all" | CitaEstado; label: string; icon: LucideIcon }[] = [
  { key: "all", label: "Todas", icon: LayoutList },
  { key: "pendiente_pago", label: "Esperando pago", icon: Wallet },
  { key: "confirmada", label: "Confirmadas", icon: CalendarCheck2 },
  { key: "completada", label: "Completadas", icon: CheckCheck },
  { key: "no_asistio", label: "No asistió", icon: UserX },
  { key: "cancelada", label: "Canceladas", icon: CalendarX2 },
]
const BARBERO_FILTROS: { key: "all" | Barbero; label: string; icon: LucideIcon }[] = [
  { key: "all", label: "Todos los barberos", icon: UserRound },
  ...BARBEROS.map((b) => ({ key: b, label: b, icon: Scissors })),
]

const TZ = "America/Lima"

function formatDateTime(iso: string) {
  const fecha = new Date(iso)
  return {
    fecha: fecha.toLocaleDateString("es-PE", { weekday: "short", day: "numeric", month: "short" }),
    hora: fecha.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }),
  }
}

/** "2026-09-21": el día al que pertenece la cita en el calendario de Lima,
 *  no en UTC — si no, todo lo de 7 p. m. en adelante cae al día siguiente. */
function diaLima(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ })
}
function mesDe(dia: string) {
  return dia.slice(0, 7)
}
function mesActual() {
  return mesDe(new Date().toLocaleDateString("en-CA", { timeZone: TZ }))
}
/** Suma (o resta) meses a un "2026-09" sin pasar por Date y su aritmética
 *  de meses desbordados. */
function mesDesplazado(mes: string, pasos: number) {
  const [anio, m] = mes.split("-").map(Number)
  const total = anio! * 12 + (m! - 1) + pasos
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`
}
function etiquetaMes(mes: string) {
  return new Date(`${mes}-01T12:00:00Z`).toLocaleDateString("es-PE", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  })
}
function etiquetaDia(dia: string) {
  return new Date(`${dia}T12:00:00Z`).toLocaleDateString("es-PE", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

// Los tokens de color existentes quedaron nombrados por el enum viejo de
// 'bookings' (pending/confirmed/cancelled/completed) — se reutilizan por
// significado en vez de duplicar tokens de CSS para el enum de citas.
const ESTADO_COLOR_TOKEN: Record<CitaEstado, string> = {
  pendiente_pago: "pending",
  confirmada: "confirmed",
  completada: "completed",
  cancelada: "cancelled",
  no_asistio: "pending",
  expirada: "cancelled",
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
  // Una fila abierta a la vez: la ficha es alta y con dos abiertas se pierde
  // la tabla de vista.
  const [abierta, setAbierta] = useState<string | null>(null)
  const [nuevaAbierta, setNuevaAbierta] = useState(false)
  // La cita que se está dando por atendida, mientras se elige con qué pagó.
  const [cobrando, setCobrando] = useState<CitaConDetalle | null>(null)
  const [cobrandoGuardando, setCobrandoGuardando] = useState(false)
  const [filter, setFilter] = useState<"all" | CitaEstado>("all")
  const [barberoFilter, setBarberoFilter] = useState<"all" | Barbero>("all")
  // La lista arranca en el mes en curso: con todo el historial junto había
  // que bajar hasta el final para llegar a lo de esta semana.
  const [mes, setMes] = useState(mesActual)
  // null = nadie tocó los días todavía, así que manda el día por defecto
  // (hoy, o el más reciente del mes). Al primer clic se materializa.
  const [diasAbiertos, setDiasAbiertos] = useState<Set<string> | null>(null)

  // Fuera del efecto para poder refrescar también al crear una cita a mano.
  const load = useCallback(async () => {
      // Fuente única: citas (WhatsApp y la reserva web escriben acá desde
      // que reserva.html pasó a agendar vía el bot en vez de una tabla
      // 'bookings' aparte sin validación de horario real.
      const { data, error } = await supabase
        .from("citas")
        .select("*, clientes!inner(nombre, telefono), services!inner(name, price)")
        // Lo último arriba: la cita de mañana importa más que la de agosto.
        .order("inicio_utc", { ascending: false })
      if (error) {
        toast.error("No se pudieron cargar las reservas.")
      } else {
        setCitas(data as CitaConDetalle[])
      }
      setLoading(false)
  }, [])

  useEffect(() => {
    load()

    const channel = supabase
      .channel("citas-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "citas" }, () => {
        load()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  /**
   * Completar es cobrar: antes de marcarla, se pregunta con qué pagó. El
   * resto de estados (cancelada, no asistió…) no mueven plata, así que van
   * directo.
   */
  function pedirEstado(cita: CitaConDetalle, estado: CitaEstado) {
    if (estado === "completada") setCobrando(cita)
    else updateStatus(cita.id, estado)
  }

  async function updateStatus(id: string, estado: CitaEstado, metodoPago?: MetodoPago) {
    const previous = citas
    setCitas((rows) => rows.map((c) => (c.id === id ? { ...c, estado, ...(metodoPago ? { metodo_pago: metodoPago } : {}) } : c)))
    try {
      // Vía el bot, no un update directo: si se cancela, el bot también
      // borra el evento de Calendar — un update directo a Supabase dejaba
      // el evento huérfano.
      await actualizarEstadoCitaBot(id, estado, metodoPago)
      toast.success(`Cita marcada como ${CITA_ESTADO_LABEL[estado].toLowerCase()}.`)
    } catch (err) {
      setCitas(previous)
      toast.error(err instanceof BotApiError ? err.message : "No se pudo actualizar el estado.")
    }
  }

  const filtered = useMemo(
    () =>
      citas
        .filter((c) => mesDe(diaLima(c.inicio_utc)) === mes)
        .filter((c) => filter === "all" || c.estado === filter)
        .filter((c) => barberoFilter === "all" || c.barbero === barberoFilter),
    [citas, mes, filter, barberoFilter],
  )

  /** Las citas del mes partidas en días, del más reciente al más antiguo.
   *  Dentro de cada día se leen en orden de agenda (de la mañana a la
   *  noche), que es como se trabaja la jornada. */
  const porDia = useMemo(() => {
    const mapa = new Map<string, CitaConDetalle[]>()
    for (const c of filtered) {
      const dia = diaLima(c.inicio_utc)
      const grupo = mapa.get(dia)
      if (grupo) grupo.push(c)
      else mapa.set(dia, [c])
    }
    return [...mapa.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([dia, lista]) => ({
        dia,
        citas: [...lista].sort((x, y) => x.inicio_utc.localeCompare(y.inicio_utc)),
      }))
  }, [filtered])

  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: TZ })
  const diaPorDefecto = porDia.some((g) => g.dia === hoy) ? hoy : porDia[0]?.dia
  const abiertos = diasAbiertos ?? new Set(diaPorDefecto ? [diaPorDefecto] : [])

  function toggleDia(dia: string) {
    const siguiente = new Set(abiertos)
    if (siguiente.has(dia)) siguiente.delete(dia)
    else siguiente.add(dia)
    setDiasAbiertos(siguiente)
  }

  // Cambiar de mes o de filtro deja los días como recién llegado: lo que
  // estaba desplegado antes ya no existe en la lista nueva.
  useEffect(() => {
    setDiasAbiertos(null)
    setAbierta(null)
  }, [mes, filter, barberoFilter])

  const confirmadasCount = filtered.filter((c) => c.estado === "confirmada").length
  const esMesActual = mes === mesActual()

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reservas</h1>
          <p className="mt-1 text-sm text-muted-foreground first-letter:uppercase">
            {loading
              ? "Cargando…"
              : `${etiquetaMes(mes)} · ${filtered.length} cita${filtered.length === 1 ? "" : "s"}, ${confirmadasCount} confirmada${confirmadasCount === 1 ? "" : "s"}.`}
          </p>
        </div>
        <Button onClick={() => setNuevaAbierta(true)} className="gap-2">
          <Plus className="size-4" />
          Nueva cita
        </Button>
      </div>

      {/* En qué mes se está parado. Los meses viejos siguen a un clic: la
          lista arranca acotada, no recortada. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={() => setMes(mesDesplazado(mes, -1))} aria-label="Mes anterior" className="chip23 px-2.5">
          <ChevronLeft className="size-3.5" />
        </button>
        <div className="brand-wide min-w-44 text-center text-[12px] capitalize">{etiquetaMes(mes)}</div>
        <button onClick={() => setMes(mesDesplazado(mes, 1))} aria-label="Mes siguiente" className="chip23 px-2.5">
          <ChevronRight className="size-3.5" />
        </button>
        {!esMesActual && (
          <button onClick={() => setMes(mesActual())} className="chip23">
            Este mes
          </button>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn("chip23 inline-flex items-center gap-1.5", filter === f.key && "on")}
          >
            <f.icon className="size-3.5" />
            {f.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {BARBERO_FILTROS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setBarberoFilter(f.key)}
            className={cn("chip23 inline-flex items-center gap-1.5", barberoFilter === f.key && "on")}
          >
            <f.icon className="size-3.5" />
            {f.label}
          </button>
        ))}
      </div>

      <NuevaCitaDialog
        open={nuevaAbierta}
        onOpenChange={setNuevaAbierta}
        onCreada={load}
      />

      {cobrando && (
        <CobroDialog
          open
          onOpenChange={(v) => !v && setCobrando(null)}
          cliente={cobrando.clientes.nombre?.trim() || cobrando.clientes.telefono}
          detalle={cobrando.services.name}
          guardando={cobrandoGuardando}
          onConfirmar={async (metodo) => {
            setCobrandoGuardando(true)
            await updateStatus(cobrando.id, "completada", metodo)
            setCobrandoGuardando(false)
            setCobrando(null)
          }}
        />
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {loading ? (
          <div className="flex flex-col gap-3 p-5">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">
            No hay reservas en <span className="lowercase">{etiquetaMes(mes)}</span> con estos filtros.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Barbero</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porDia.map((grupo) => {
                  const desplegado = abiertos.has(grupo.dia)
                  return (
                    <Fragment key={grupo.dia}>
                      <TableRow
                        onClick={() => toggleDia(grupo.dia)}
                        className="cursor-pointer border-t-2 border-border bg-muted/50 hover:bg-muted"
                      >
                        <TableCell colSpan={7} className="py-2.5">
                          <div className="flex items-center gap-2">
                            <ChevronRight
                              className={cn(
                                "size-4 text-muted-foreground transition-transform",
                                desplegado && "rotate-90",
                              )}
                            />
                            <span className="text-sm font-semibold first-letter:uppercase">
                              {etiquetaDia(grupo.dia)}
                            </span>
                            {grupo.dia === hoy && (
                              <Badge variant="outline" className="border-transparent bg-foreground text-[10px] text-background">
                                Hoy
                              </Badge>
                            )}
                            <span className="ml-auto text-xs text-muted-foreground">
                              {grupo.citas.length} cita{grupo.citas.length === 1 ? "" : "s"}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>

                      {desplegado && grupo.citas.map((c) => {
                  const { hora } = formatDateTime(c.inicio_utc)
                  const expandida = abierta === c.id
                  return (
                    <Fragment key={c.id}>
                    <TableRow
                      onClick={() => setAbierta(expandida ? null : c.id)}
                      className="cursor-pointer"
                    >
                      <TableCell className="whitespace-nowrap font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          <ChevronRight
                            className={cn("size-3.5 text-muted-foreground transition-transform", expandida && "rotate-90")}
                          />
                          {hora}
                        </span>
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
                        <span className="text-sm">
                          {c.services.name}
                          {/* Precio del servicio tal como está hoy en la carta: la cita no
                              guarda el monto cobrado, así que "Consultar" o un rango se
                              muestran tal cual en vez de convertirse en un número falso. */}
                          <span className="text-muted-foreground">
                            {" · "}
                            {(() => {
                              const n = precioNumerico(c.services.price)
                              return n != null ? formatoSoles(n) : c.services.price
                            })()}
                          </span>
                        </span>
                        {c.notas && <div className="mt-0.5 text-xs text-muted-foreground">{c.notas}</div>}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.barbero ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.creada_por === "bot" ? "WhatsApp" : "Web / manual"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge estado={c.estado} />
                        {c.comprobante_estado !== "sin_comprobante" && (
                          <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <ImageIcon className="size-3" />
                            {COMPROBANTE_ESTADO_LABEL[c.comprobante_estado]}
                          </div>
                        )}
                        {c.metodo_pago && (
                          <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Wallet className="size-3" />
                            {METODO_PAGO_LABEL[c.metodo_pago]}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
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
                                onClick={() => pedirEstado(c, estado)}
                              >
                                {CITA_ESTADO_LABEL[estado]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {expandida && (
                      <TableRow className="hover:bg-transparent">
                        {/* whitespace-normal anula el nowrap que TableCell trae
                            de fábrica: la ficha lleva texto largo (la nota del
                            análisis del comprobante) que si no se sale de su
                            columna y se monta sobre la de al lado. */}
                        <TableCell colSpan={7} className="bg-muted/40 p-0 whitespace-normal">
                          <FichaReserva cita={c} />
                        </TableCell>
                      </TableRow>
                    )}
                    </Fragment>
                  )
                      })}
                    </Fragment>
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
