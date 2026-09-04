import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, X } from "lucide-react"
import { getDisponibilidad, reagendarCita, BotApiError } from "@/lib/botApi"
import { cn } from "@/lib/utils"
import type { CitaAgenda } from "./Agenda"

const TZ = "America/Lima"

/** Los próximos 10 días como fechas de Lima (YYYY-MM-DD). */
function proximosDias(cantidad = 10): string[] {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: TZ })
  const dias: string[] = []
  const cursor = new Date(`${hoy}T12:00:00Z`)
  for (let i = 0; i < cantidad; i++) {
    dias.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dias
}

function etiquetaDia(fecha: string): { dia: string; num: string; mes: string } {
  const d = new Date(`${fecha}T12:00:00Z`)
  return {
    dia: d.toLocaleDateString("es-PE", { timeZone: "UTC", weekday: "short" }),
    num: String(d.getUTCDate()),
    mes: d.toLocaleDateString("es-PE", { timeZone: "UTC", month: "short" }),
  }
}

/**
 * Mover una cita de horario. Los huecos los calcula el bot contra la agenda
 * de esa silla — el navegador no puede: un barbero no ve las citas de sus
 * compañeros, así que no tiene con qué saber qué está ocupado.
 */
export default function Reagendar({
  cita,
  onCerrar,
  onListo,
}: {
  cita: CitaAgenda
  onCerrar: () => void
  onListo: () => Promise<void> | void
}) {
  const dias = proximosDias()
  const [fecha, setFecha] = useState(dias[0]!)
  const [horas, setHoras] = useState<string[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    setCargando(true)
    getDisponibilidad({
      servicio_id: cita.servicio_id,
      fecha_desde: fecha,
      ...(cita.barbero ? { barbero: cita.barbero } : {}),
    })
      .then((dias) => {
        if (!activo) return
        setHoras(dias.find((d) => d.fecha === fecha)?.horas ?? [])
      })
      .catch(() => {
        if (activo) toast.error("No se pudo consultar la disponibilidad.")
      })
      .finally(() => {
        if (activo) setCargando(false)
      })
    return () => {
      activo = false
    }
  }, [fecha, cita.servicio_id, cita.barbero])

  async function mover(hora: string) {
    setGuardando(hora)
    try {
      await reagendarCita(cita.id, fecha, hora)
      toast.success("Cita movida.")
      await onListo()
    } catch (err) {
      toast.error(err instanceof BotApiError ? err.message : "No se pudo mover la cita.")
    } finally {
      setGuardando(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div>
          <div className="brand-display text-[19px]">Mover cita</div>
          <div className="brand-serif text-[12px] text-muted-foreground">{cita.services.name}</div>
        </div>
        <button onClick={onCerrar} aria-label="Cerrar" className="flex size-11 items-center justify-center">
          <X className="size-5" />
        </button>
      </header>

      <div className="px-4 py-4 pb-24">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
          {dias.map((d) => {
            const { dia, num, mes } = etiquetaDia(d)
            return (
              <button
                key={d}
                onClick={() => setFecha(d)}
                className={cn(
                  "flex w-16 shrink-0 flex-col items-center border border-border bg-card py-2",
                  fecha === d && "border-foreground bg-foreground text-background",
                )}
              >
                <span className="brand-serif text-[11px] lowercase">{dia}</span>
                <span className="brand-wide text-[19px] leading-none">{num}</span>
                <span className="text-[10px] opacity-70">{mes}</span>
              </button>
            )
          })}
        </div>

        {cargando ? (
          <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Buscando horarios…
          </div>
        ) : horas.length === 0 ? (
          <p className="brand-serif py-12 text-center text-sm text-muted-foreground">
            No hay horarios libres ese día{cita.barbero ? ` para ${cita.barbero}` : ""}.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {horas.map((h) => (
              <button
                key={h}
                disabled={guardando != null}
                onClick={() => mover(h)}
                className="tnum border border-border bg-card py-3 text-[15px] disabled:opacity-40"
              >
                {guardando === h ? <Loader2 className="mx-auto size-4 animate-spin" /> : h}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
