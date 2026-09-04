import { useEffect, useState } from "react"
import { toast } from "sonner"
import { CalendarPlus, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { getDisponibilidad, crearCitaManual, BotApiError } from "@/lib/botApi"
import { BARBEROS, type Barbero } from "@/lib/types"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const TZ = "America/Lima"

type Servicio = { id: string; name: string; duration: string; price: string }

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
 * adelanto — el cliente ya está en el local.
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
      .select("id, name, duration, price")
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="size-4" />
            Nueva cita
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Servicio</Label>
            <select
              value={servicioId}
              onChange={(e) => setServicioId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-ring"
            >
              <option value="">Elegir servicio…</option>
              {servicios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.duration} · S/ {s.price}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>Barbero</Label>
            <div className="flex flex-wrap gap-2">
              {BARBEROS.map((b) => (
                <Button
                  key={b}
                  type="button"
                  size="sm"
                  variant={barbero === b ? "default" : "outline"}
                  onClick={() => setBarbero(barbero === b ? "" : b)}
                >
                  {b}
                </Button>
              ))}
            </div>
            {!barbero && (
              <p className="text-xs text-muted-foreground">
                Sin elegir, se muestran los horarios libres de cualquier silla.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" />
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp</Label>
              <Input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                inputMode="numeric"
                placeholder="987 654 321"
              />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {dias.map((d) => (
              <Button
                key={d}
                type="button"
                size="sm"
                variant={fecha === d ? "default" : "outline"}
                onClick={() => setFecha(d)}
                className="shrink-0 capitalize"
              >
                {etiquetaDia(d)}
              </Button>
            ))}
          </div>

          {!servicioId ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Elige un servicio para ver los horarios libres.
            </p>
          ) : buscando ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Buscando horarios…
            </div>
          ) : horas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No hay horarios libres ese día{barbero ? ` para ${barbero}` : ""}.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {horas.map((h) => (
                <Button
                  key={h}
                  type="button"
                  variant="outline"
                  disabled={!listo || guardando != null}
                  onClick={() => crear(h)}
                  className={cn("tabular-nums", guardando === h && "opacity-60")}
                >
                  {guardando === h ? <Loader2 className="size-4 animate-spin" /> : h}
                </Button>
              ))}
            </div>
          )}

          {servicioId && horas.length > 0 && !listo && (
            <p className="text-center text-xs text-muted-foreground">
              Completa nombre y WhatsApp del cliente para poder agendar.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
