import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Check, Loader2, Phone, Plus, UserX } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import { actualizarEstadoCita, BotApiError } from "@/lib/botApi"
import { BARBEROS, CITA_ESTADO_LABEL, type Barbero, type CitaEstado } from "@/lib/types"
import { cn } from "@/lib/utils"
import DetalleCita from "./DetalleCita"
import NuevaCita from "./NuevaCita"

export type CitaAgenda = {
  id: string
  cliente_id: string
  servicio_id: string
  inicio_utc: string
  fin_utc: string
  estado: CitaEstado
  barbero: string | null
  notas: string | null
  atencion_notas: string | null
  comprobante_estado: string
  clientes: { nombre: string | null; telefono: string }
  services: { name: string }
}

const TZ = "America/Lima"

/** "2026-09-02" del día de Lima, no del navegador (que puede estar en otro huso). */
function diaLima(fecha: Date): string {
  return fecha.toLocaleDateString("en-CA", { timeZone: TZ })
}

function horaLima(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-PE", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })
}

function etiquetaDia(fecha: string): string {
  const hoy = diaLima(new Date())
  const manana = (() => {
    const d = new Date(`${hoy}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + 1)
    return d.toISOString().slice(0, 10)
  })()
  if (fecha === hoy) return "Hoy"
  if (fecha === manana) return "Mañana"
  return new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-PE", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

const COLOR_ESTADO: Record<string, string> = {
  confirmada: "text-status-confirmed",
  completada: "text-status-completed",
  pendiente_pago: "text-status-pending",
  no_asistio: "text-status-pending",
  cancelada: "text-status-cancelled",
  expirada: "text-status-cancelled",
}

/**
 * La agenda del día a día. Un barbero ve solo la suya (lo impone RLS, no la
 * pantalla); el dueño ve las tres y puede filtrar por silla.
 */
export default function Agenda() {
  const { role, barbero } = useAuth()
  const esDueno = role === "superadmin" || role === "staff"

  const [citas, setCitas] = useState<CitaAgenda[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtroBarbero, setFiltroBarbero] = useState<Barbero | "todos">(
    // El dueño abre en "lo mío" si además es barbero: es su vista diaria.
    (barbero as Barbero | null) ?? "todos",
  )
  const [detalle, setDetalle] = useState<CitaAgenda | null>(null)
  const [nuevaAbierta, setNuevaAbierta] = useState(false)
  const [accionando, setAccionando] = useState<string | null>(null)
  const version = useRef(0)

  const cargar = useCallback(async () => {
    const v = ++version.current
    // Desde hoy en adelante: la agenda es para trabajar, no un historial.
    const desde = `${diaLima(new Date())}T00:00:00-05:00`
    const { data, error } = await supabase
      .from("citas")
      .select(
        "id, cliente_id, servicio_id, inicio_utc, fin_utc, estado, barbero, notas, atencion_notas, comprobante_estado, clientes!inner(nombre, telefono), services!inner(name)",
      )
      .gte("inicio_utc", desde)
      .in("estado", ["confirmada", "pendiente_pago", "completada", "no_asistio"])
      .order("inicio_utc")
    if (v !== version.current) return
    if (error) {
      toast.error("No se pudo cargar la agenda.")
      setCitas([])
    } else {
      setCitas((data ?? []) as unknown as CitaAgenda[])
    }
    setCargando(false)
  }, [])

  useEffect(() => {
    cargar()
    const canal = supabase
      .channel("agenda-movil")
      .on("postgres_changes", { event: "*", schema: "public", table: "citas" }, () => cargar())
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [cargar])

  const visibles = useMemo(
    () => (filtroBarbero === "todos" ? citas : citas.filter((c) => c.barbero === filtroBarbero)),
    [citas, filtroBarbero],
  )

  const porDia = useMemo(() => {
    const grupos = new Map<string, CitaAgenda[]>()
    for (const cita of visibles) {
      const dia = diaLima(new Date(cita.inicio_utc))
      const actual = grupos.get(dia)
      if (actual) actual.push(cita)
      else grupos.set(dia, [cita])
    }
    return [...grupos.entries()]
  }, [visibles])

  async function marcar(cita: CitaAgenda, estado: CitaEstado) {
    setAccionando(cita.id)
    try {
      await actualizarEstadoCita(cita.id, estado)
      toast.success(`Marcada como ${CITA_ESTADO_LABEL[estado].toLowerCase()}.`)
      await cargar()
    } catch (err) {
      toast.error(err instanceof BotApiError ? err.message : "No se pudo actualizar.")
    } finally {
      setAccionando(null)
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Cargando tu agenda…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="brand-display text-[26px]">Agenda</h1>
        <button onClick={() => setNuevaAbierta(true)} className="chip23 on inline-flex items-center gap-1.5 py-2.5">
          <Plus className="size-3.5" /> Nueva cita
        </button>
      </div>

      {esDueno && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFiltroBarbero("todos")} className={cn("chip23", filtroBarbero === "todos" && "on")}>
            Todos
          </button>
          {BARBEROS.map((b) => (
            <button key={b} onClick={() => setFiltroBarbero(b)} className={cn("chip23", filtroBarbero === b && "on")}>
              {b}
            </button>
          ))}
        </div>
      )}

      {porDia.length === 0 ? (
        <p className="brand-serif border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
          No tienes citas próximas.
        </p>
      ) : (
        porDia.map(([dia, delDia]) => (
          <section key={dia} className="space-y-2">
            <h2 className="brand-wide sticky top-0 z-10 bg-background py-2 text-[11px] text-muted-foreground">
              {etiquetaDia(dia)} · {delDia.length}
            </h2>

            {delDia.map((cita) => (
              <article key={cita.id} className="border border-border bg-card">
                <button onClick={() => setDetalle(cita)} className="flex w-full items-start gap-3 p-3 text-left">
                  <div className="brand-wide tnum shrink-0 text-[19px] leading-none">{horaLima(cita.inicio_utc)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold">
                      {cita.clientes.nombre?.trim() || cita.clientes.telefono}
                    </div>
                    <div className="brand-serif truncate text-[13px] text-muted-foreground">{cita.services.name}</div>
                    <div className={cn("brand-wide mt-1 text-[10px]", COLOR_ESTADO[cita.estado])}>
                      {CITA_ESTADO_LABEL[cita.estado]}
                      {esDueno && cita.barbero && ` · ${cita.barbero}`}
                    </div>
                  </div>
                </button>

                {/* Los dos gestos del día: atendido o no vino. Todo lo demás
                    (notas, mover, cancelar) vive en el detalle. */}
                {(cita.estado === "confirmada" || cita.estado === "pendiente_pago") && (
                  <div className="flex border-t border-border">
                    <a
                      href={`https://wa.me/${cita.clientes.telefono}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-1 items-center justify-center gap-1.5 border-r border-border py-3 text-[12px] text-muted-foreground"
                    >
                      <Phone className="size-3.5" /> Escribir
                    </a>
                    <button
                      disabled={accionando === cita.id}
                      onClick={() => marcar(cita, "no_asistio")}
                      className="flex flex-1 items-center justify-center gap-1.5 border-r border-border py-3 text-[12px] text-muted-foreground disabled:opacity-40"
                    >
                      <UserX className="size-3.5" /> No vino
                    </button>
                    <button
                      disabled={accionando === cita.id}
                      onClick={() => marcar(cita, "completada")}
                      className="brand-wide flex flex-1 items-center justify-center gap-1.5 bg-foreground py-3 text-[11px] text-background disabled:opacity-40"
                    >
                      {accionando === cita.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                      Atendido
                    </button>
                  </div>
                )}
              </article>
            ))}
          </section>
        ))
      )}

      {detalle && <DetalleCita cita={detalle} onCerrar={() => setDetalle(null)} onCambio={cargar} />}
      {nuevaAbierta && <NuevaCita onCerrar={() => setNuevaAbierta(false)} onCreada={cargar} />}
    </div>
  )
}
