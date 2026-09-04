import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, X } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth"
import { getDisponibilidad, crearCitaManual, BotApiError } from "@/lib/botApi"
import { BARBEROS, type Barbero } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const TZ = "America/Lima"

type Servicio = { id: string; name: string; duration: string; price: string }

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

function etiquetaDia(fecha: string) {
  const d = new Date(`${fecha}T12:00:00Z`)
  return {
    dia: d.toLocaleDateString("es-PE", { timeZone: "UTC", weekday: "short" }),
    num: String(d.getUTCDate()),
    mes: d.toLocaleDateString("es-PE", { timeZone: "UTC", month: "short" }),
  }
}

/** "987654321" → "51987654321" (mismo criterio que la reserva de la web). */
function normalizarTelefono(raw: string): string {
  const digitos = raw.replace(/\D/g, "")
  return digitos.startsWith("51") ? digitos : `51${digitos}`
}

/**
 * Cita cargada a mano: el cliente que llegó sin reservar, o que coordinó
 * directo con el barbero. Nace confirmada (el cliente ya está ahí), sin
 * adelanto — el bot se encarga de eso y del evento de Calendar.
 */
export default function NuevaCita({ onCerrar, onCreada }: { onCerrar: () => void; onCreada: () => Promise<void> | void }) {
  const { role, barbero } = useAuth()
  const esDueno = role === "superadmin" || role === "staff"

  const [servicios, setServicios] = useState<Servicio[]>([])
  const [servicioId, setServicioId] = useState("")
  const [barberoSel, setBarberoSel] = useState<Barbero | "">((barbero as Barbero | null) ?? "")
  const [nombre, setNombre] = useState("")
  const [telefono, setTelefono] = useState("")
  const [fecha, setFecha] = useState(proximosDias()[0]!)
  const [horas, setHoras] = useState<string[]>([])
  const [buscando, setBuscando] = useState(false)
  const [guardando, setGuardando] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from("services")
      .select("id, name, duration, price")
      .eq("active", true)
      .order("sort_order")
      .then(({ data }) => setServicios((data as Servicio[] | null) ?? []))
  }, [])

  useEffect(() => {
    if (!servicioId) {
      setHoras([])
      return
    }
    let activo = true
    setBuscando(true)
    getDisponibilidad({
      servicio_id: servicioId,
      fecha_desde: fecha,
      ...(barberoSel ? { barbero: barberoSel } : {}),
    })
      .then((dias) => {
        if (activo) setHoras(dias.find((d) => d.fecha === fecha)?.horas ?? [])
      })
      .catch(() => {
        if (activo) toast.error("No se pudo consultar la disponibilidad.")
      })
      .finally(() => {
        if (activo) setBuscando(false)
      })
    return () => {
      activo = false
    }
  }, [servicioId, fecha, barberoSel])

  const listo = servicioId && nombre.trim().length > 1 && telefono.replace(/\D/g, "").length >= 6

  async function crear(hora: string) {
    setGuardando(hora)
    try {
      await crearCitaManual({
        servicio_id: servicioId,
        fecha,
        hora,
        nombre_cliente: nombre.trim(),
        telefono_cliente: normalizarTelefono(telefono),
        ...(esDueno && barberoSel ? { barbero: barberoSel } : {}),
      })
      toast.success("Cita creada.")
      await onCreada()
      onCerrar()
    } catch (err) {
      toast.error(err instanceof BotApiError ? err.message : "No se pudo crear la cita.")
    } finally {
      setGuardando(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="brand-display text-[19px]">Nueva cita</div>
        <button onClick={onCerrar} aria-label="Cerrar" className="flex size-11 items-center justify-center">
          <X className="size-5" />
        </button>
      </header>

      <div className="space-y-4 px-4 py-4 pb-24">
        <div className="space-y-1.5">
          <Label className="brand-serif">Servicio</Label>
          <select
            value={servicioId}
            onChange={(e) => setServicioId(e.target.value)}
            className="h-12 w-full border border-input bg-card px-3 text-[15px] outline-none focus:border-foreground"
          >
            <option value="">Elegir servicio…</option>
            {servicios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.duration} · S/ {s.price}
              </option>
            ))}
          </select>
        </div>

        {esDueno && (
          <div className="space-y-1.5">
            <Label className="brand-serif">Barbero</Label>
            <div className="flex flex-wrap gap-2">
              {BARBEROS.map((b) => (
                <button
                  key={b}
                  onClick={() => setBarberoSel(barberoSel === b ? "" : b)}
                  className={cn("chip23 py-2.5", barberoSel === b && "on")}
                >
                  {b}
                </button>
              ))}
            </div>
            {!barberoSel && (
              <p className="brand-serif text-[12px] text-muted-foreground">
                Sin elegir, se le asigna al primero que esté libre.
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="brand-serif">Cliente</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" className="h-12" />
          </div>
          <div className="space-y-1.5">
            <Label className="brand-serif">WhatsApp</Label>
            <Input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              inputMode="numeric"
              placeholder="987 654 321"
              className="h-12"
            />
          </div>
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
          {proximosDias().map((d) => {
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

        {!servicioId ? (
          <p className="brand-serif py-8 text-center text-sm text-muted-foreground">
            Elige un servicio para ver los horarios libres.
          </p>
        ) : buscando ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Buscando horarios…
          </div>
        ) : horas.length === 0 ? (
          <p className="brand-serif py-8 text-center text-sm text-muted-foreground">No hay horarios libres ese día.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {horas.map((h) => (
              <button
                key={h}
                disabled={!listo || guardando != null}
                onClick={() => crear(h)}
                className="tnum border border-border bg-card py-3 text-[15px] disabled:opacity-40"
              >
                {guardando === h ? <Loader2 className="mx-auto size-4 animate-spin" /> : h}
              </button>
            ))}
          </div>
        )}

        {servicioId && horas.length > 0 && !listo && (
          <p className="brand-serif text-center text-[12px] text-muted-foreground">
            Completa nombre y WhatsApp del cliente para poder agendar.
          </p>
        )}
      </div>
    </div>
  )
}
