import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { getDisponibilidad, crearCitaManual, BotApiError } from "@/lib/botApi"
import { BARBEROS, type Barbero } from "@/lib/types"
import { ModalFicha } from "@/components/ModalFicha"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const TZ = "America/Lima"

type Servicio = { id: string; name: string; duration: string; duration_minutes: number | null; price: string }

function proximosDias(cantidad = 8): string[] {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: TZ })
  const dias: string[] = []
  const cursor = new Date(`${hoy}T12:00:00Z`)
  for (let i = 0; i < cantidad; i++) {
    dias.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dias
}

function etiquetaDia(fecha: string): string {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: TZ })
  if (fecha === hoy) return "Hoy"
  const d = new Date(`${fecha}T12:00:00Z`)
  return d.toLocaleDateString("es-PE", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" })
}

/** "987654321" → "51987654321", igual que la reserva de la web. */
function normalizarTelefono(raw: string): string {
  const digitos = raw.replace(/\D/g, "")
  return digitos.startsWith("51") ? digitos : `51${digitos}`
}

/**
 * Cita cargada a mano desde recepción: el cliente que llegó sin reservar.
 * Pasa por el bot (no un insert directo) para que valide el hueco contra la
 * agenda de esa silla y cree el evento de Calendar. Nace confirmada y sin
 * pago por adelantado — el cliente ya está en el local.
 */
export default function NuevaCitaDialog({
  open,
  onOpenChange,
  onCreada,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreada: () => Promise<void> | void
}) {
  const dias = proximosDias()
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [servicioId, setServicioId] = useState("")
  const [barbero, setBarbero] = useState<Barbero | "">("")
  const [nombre, setNombre] = useState("")
  const [telefono, setTelefono] = useState("")
  const [fecha, setFecha] = useState(dias[0]!)
  const [horas, setHoras] = useState<string[]>([])
  const [buscando, setBuscando] = useState(false)
  const [guardando, setGuardando] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setServicioId("")
    setBarbero("")
    setNombre("")
    setTelefono("")
    setFecha(proximosDias()[0]!)
    setHoras([])
    supabase
      .from("services")
      .select("id, name, duration, duration_minutes, price")
      .eq("active", true)
      .order("sort_order")
      .then(({ data }) => setServicios((data as Servicio[] | null) ?? []))
  }, [open])

  useEffect(() => {
    if (!open || !servicioId) {
      setHoras([])
      return
    }
    let activo = true
    setBuscando(true)
    getDisponibilidad({
      servicio_id: servicioId,
      fecha_desde: fecha,
      ...(barbero ? { barbero } : {}),
    })
      .then((d) => {
        if (activo) setHoras(d.find((x) => x.fecha === fecha)?.horas ?? [])
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
  }, [open, servicioId, fecha, barbero])

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
        ...(barbero ? { barbero } : {}),
      })
      toast.success("Cita creada.")
      await onCreada()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof BotApiError ? err.message : "No se pudo crear la cita.")
    } finally {
      setGuardando(null)
    }
  }

  return (
    <ModalFicha
      open={open}
      onOpenChange={onOpenChange}
      mini="Cliente que llegó sin reservar"
      titulo="Nueva cita"
      ancho="sm:max-w-xl"
    >
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label className="brand-serif">Servicio</Label>
          <select
            value={servicioId}
            onChange={(e) => setServicioId(e.target.value)}
            className="h-11 w-full rounded-none border border-border bg-card px-3 text-sm outline-none focus:border-foreground"
          >
            <option value="">Elegir servicio…</option>
            {/* Sin minutos cargados el bot no puede calcular a qué hora
                termina, así que el servicio no se puede usar hasta que se le
                ponga la duración en Servicios. */}
            {servicios.map((s) => (
              <option key={s.id} value={s.id} disabled={s.duration_minutes == null}>
                {s.name} · {s.duration} · S/ {s.price}
                {s.duration_minutes == null ? " (falta duración)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="brand-serif">Cliente</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre y apellido"
              className="h-11 rounded-none"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="brand-serif">WhatsApp</Label>
            <Input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              inputMode="numeric"
              placeholder="987 654 321"
              className="tnum h-11 rounded-none"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="brand-serif">Barbero</Label>
          <div className="flex flex-wrap gap-2">
            {BARBEROS.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBarbero(barbero === b ? "" : b)}
                className={cn("chip23", barbero === b && "on")}
              >
                {b}
              </button>
            ))}
          </div>
          {!barbero && (
            <p className="brand-serif text-[12px] text-muted-foreground">
              Sin elegir, se muestran los horarios libres de cualquier silla.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="brand-serif">Día</Label>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {dias.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setFecha(d)}
                className={cn("chip23 shrink-0 whitespace-nowrap", fecha === d && "on")}
              >
                {etiquetaDia(d)}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <div className="brand-wide mb-3 text-[10px] text-muted-foreground">Horarios libres</div>
          {!servicioId ? (
            <p className="brand-serif py-6 text-center text-[13px] text-muted-foreground">
              Elige un servicio para ver los horarios libres.
            </p>
          ) : buscando ? (
            <div className="brand-serif flex items-center justify-center gap-2 py-6 text-[13px] text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Buscando horarios…
            </div>
          ) : horas.length === 0 ? (
            <p className="brand-serif py-6 text-center text-[13px] text-muted-foreground">
              No hay horarios libres ese día{barbero ? ` para ${barbero}` : ""}.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {horas.map((h) => (
                  <button
                    key={h}
                    type="button"
                    disabled={!listo || guardando != null}
                    onClick={() => crear(h)}
                    className={cn(
                      "chip23 tnum flex items-center justify-center py-3 disabled:opacity-35",
                      guardando === h && "on",
                    )}
                  >
                    {guardando === h ? <Loader2 className="size-3.5 animate-spin" /> : h}
                  </button>
                ))}
              </div>
              <p className="brand-serif mt-3 text-center text-[12px] text-muted-foreground">
                {listo
                  ? "Toca la hora y la cita queda creada y confirmada."
                  : "Completa nombre y WhatsApp del cliente para poder agendar."}
              </p>
            </>
          )}
        </div>
      </div>
    </ModalFicha>
  )
}
