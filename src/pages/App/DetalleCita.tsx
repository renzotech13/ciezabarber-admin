import { useEffect, useState } from "react"
import { toast } from "sonner"
import { CalendarClock, Loader2, X } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { guardarAtencion, actualizarEstadoCita, BotApiError } from "@/lib/botApi"
import { CITA_ESTADO_LABEL } from "@/lib/types"
import { Textarea } from "@/components/ui/textarea"
import type { CitaAgenda } from "./Agenda"
import Reagendar from "./Reagendar"

const TZ = "America/Lima"

function fechaLarga(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString("es-PE", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" })} · ${d.toLocaleTimeString(
    "es-PE",
    { timeZone: TZ, hour: "2-digit", minute: "2-digit" },
  )}`
}

type Ficha = { preferencias: string | null; alergias: string | null; notas: string | null }
type VisitaPrevia = { id: string; inicio_utc: string; atencion_notas: string | null; servicio_id: string }

/**
 * Hoja de detalle a pantalla completa (patrón de app, no un diálogo chico):
 * lo que el barbero necesita antes y después de atender — la ficha del
 * cliente, qué le hizo la vez pasada, y las acciones sobre la cita.
 */
export default function DetalleCita({
  cita,
  onCerrar,
  onCambio,
}: {
  cita: CitaAgenda
  onCerrar: () => void
  onCambio: () => Promise<void> | void
}) {
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [previas, setPrevias] = useState<VisitaPrevia[]>([])
  const [atencion, setAtencion] = useState(cita.atencion_notas ?? "")
  const [guardando, setGuardando] = useState(false)
  const [accionando, setAccionando] = useState(false)
  const [reagendando, setReagendando] = useState(false)

  useEffect(() => {
    let activo = true
    async function cargar() {
      const [fichaRes, previasRes] = await Promise.all([
        supabase.from("clientes").select("preferencias, alergias, notas").eq("id", cita.cliente_id).maybeSingle(),
        supabase
          .from("citas")
          .select("id, inicio_utc, atencion_notas, servicio_id")
          .eq("cliente_id", cita.cliente_id)
          .neq("id", cita.id)
          .lt("inicio_utc", new Date().toISOString())
          .order("inicio_utc", { ascending: false })
          .limit(5),
      ])
      if (!activo) return
      setFicha((fichaRes.data as Ficha | null) ?? null)
      setPrevias((previasRes.data as VisitaPrevia[] | null) ?? [])
    }
    cargar()
    return () => {
      activo = false
    }
  }, [cita.cliente_id, cita.id])

  async function guardarNotas() {
    setGuardando(true)
    try {
      await guardarAtencion(cita.id, atencion)
      toast.success("Anotado.")
      await onCambio()
    } catch (err) {
      toast.error(err instanceof BotApiError ? err.message : "No se pudo guardar.")
    } finally {
      setGuardando(false)
    }
  }

  async function cancelar() {
    if (!window.confirm("¿Cancelar esta cita? Se libera el horario y se borra del calendario.")) return
    setAccionando(true)
    try {
      await actualizarEstadoCita(cita.id, "cancelada")
      toast.success("Cita cancelada.")
      await onCambio()
      onCerrar()
    } catch (err) {
      toast.error(err instanceof BotApiError ? err.message : "No se pudo cancelar.")
    } finally {
      setAccionando(false)
    }
  }

  if (reagendando) {
    return (
      <Reagendar
        cita={cita}
        onCerrar={() => setReagendando(false)}
        onListo={async () => {
          await onCambio()
          onCerrar()
        }}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <div className="brand-display truncate text-[19px]">
            {cita.clientes.nombre?.trim() || cita.clientes.telefono}
          </div>
          <div className="brand-serif text-[12px] text-muted-foreground">{fechaLarga(cita.inicio_utc)}</div>
        </div>
        <button onClick={onCerrar} aria-label="Cerrar" className="flex size-11 shrink-0 items-center justify-center">
          <X className="size-5" />
        </button>
      </header>

      <div className="space-y-4 px-4 py-4 pb-24">
        <section className="border border-border bg-card p-4">
          <div className="text-[15px] font-semibold">{cita.services.name}</div>
          <div className="brand-serif mt-1 text-[13px] text-muted-foreground">
            {CITA_ESTADO_LABEL[cita.estado]}
            {cita.barbero && ` · ${cita.barbero}`}
          </div>
          {cita.notas && (
            <p className="brand-serif mt-2 border-t border-border pt-2 text-[13px] text-muted-foreground">
              Pidió al reservar: {cita.notas}
            </p>
          )}
          <a
            href={`https://wa.me/${cita.clientes.telefono}`}
            target="_blank"
            rel="noreferrer"
            className="brand-wide mt-3 inline-block text-[11px] underline underline-offset-4"
          >
            Escribirle por WhatsApp
          </a>
        </section>

        {(ficha?.preferencias || ficha?.alergias || ficha?.notas) && (
          <section className="border border-border bg-card p-4">
            <h3 className="brand-wide text-[10px] text-muted-foreground">Ficha del cliente</h3>
            {ficha.alergias && (
              <p className="mt-2 text-[13px]">
                <span className="text-status-cancelled">Cuidado:</span> {ficha.alergias}
              </p>
            )}
            {ficha.preferencias && <p className="mt-2 text-[13px]">{ficha.preferencias}</p>}
            {ficha.notas && <p className="brand-serif mt-2 text-[13px] text-muted-foreground">{ficha.notas}</p>}
          </section>
        )}

        <section className="border border-border bg-card p-4">
          <h3 className="brand-wide text-[10px] text-muted-foreground">Qué le hiciste hoy</h3>
          <Textarea
            value={atencion}
            onChange={(e) => setAtencion(e.target.value)}
            placeholder="Fade medio, máquina 1 a los lados, tijera arriba…"
            rows={3}
            className="mt-2"
          />
          <button onClick={guardarNotas} disabled={guardando} className="chip23 on mt-3 w-full py-3 disabled:opacity-40">
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </section>

        <section className="border border-border bg-card p-4">
          <h3 className="brand-wide text-[10px] text-muted-foreground">Visitas anteriores</h3>
          {previas.length === 0 ? (
            <p className="brand-serif mt-2 text-[13px] text-muted-foreground">Primera vez que lo atienden.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {previas.map((v) => (
                <li key={v.id} className="border-b border-border/60 pb-2 text-[13px] last:border-b-0 last:pb-0">
                  <span className="brand-serif text-muted-foreground">
                    {new Date(v.inicio_utc).toLocaleDateString("es-PE", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  {v.atencion_notas ? <p className="mt-0.5 whitespace-pre-wrap">{v.atencion_notas}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {(cita.estado === "confirmada" || cita.estado === "pendiente_pago") && (
          <div className="flex gap-2">
            <button
              onClick={() => setReagendando(true)}
              className="chip23 flex flex-1 items-center justify-center gap-1.5 py-3"
            >
              <CalendarClock className="size-3.5" /> Mover
            </button>
            <button
              onClick={cancelar}
              disabled={accionando}
              className="chip23 flex-1 py-3 disabled:opacity-40"
              style={{ borderColor: "var(--destructive)", color: "var(--destructive)" }}
            >
              {accionando ? <Loader2 className="mx-auto size-3.5 animate-spin" /> : "Cancelar cita"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
