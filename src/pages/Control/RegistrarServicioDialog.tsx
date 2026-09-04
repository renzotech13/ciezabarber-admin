import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { registrarServicioAtendido, BotApiError } from "@/lib/botApi"
import { BARBEROS, METODOS_PAGO, METODO_PAGO_LABEL, type Barbero, type MetodoPago } from "@/lib/types"
import { ModalFicha } from "@/components/ModalFicha"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const TZ = "America/Lima"

type Servicio = { id: string; name: string; duration: string; price: string }

/** "2026-09-04" y "18:30" de ahora mismo, en el calendario de Lima. */
function ahoraLima(): { fecha: string; hora: string } {
  const ahora = new Date()
  return {
    fecha: ahora.toLocaleDateString("en-CA", { timeZone: TZ }),
    hora: ahora.toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }),
  }
}

/**
 * El cliente que entró sin reserva y ya se atendió: se registra acá, en
 * Control, porque lo que hace falta de él es que entre al libro de comisiones
 * y a la caja del mes.
 *
 * No pasa por la agenda ni por "Nueva cita": esa valida horarios futuros y
 * pide anticipación mínima, así que un servicio que acaba de ocurrir siempre
 * lo rechazaría. Este nace completada.
 */
export default function RegistrarServicioDialog({
  open,
  onOpenChange,
  onRegistrado,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRegistrado: () => Promise<void> | void
}) {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [servicioId, setServicioId] = useState("")
  const [barbero, setBarbero] = useState<Barbero | "">("")
  const [metodo, setMetodo] = useState<MetodoPago | null>(null)
  const [fecha, setFecha] = useState(ahoraLima().fecha)
  const [hora, setHora] = useState(ahoraLima().hora)
  const [nombre, setNombre] = useState("")
  const [telefono, setTelefono] = useState("")
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!open) return
    const ahora = ahoraLima()
    setServicioId("")
    setBarbero("")
    setMetodo(null)
    setFecha(ahora.fecha)
    setHora(ahora.hora)
    setNombre("")
    setTelefono("")
    supabase
      .from("services")
      .select("id, name, duration, price")
      .eq("active", true)
      .order("sort_order")
      .then(({ data }) => setServicios((data as Servicio[] | null) ?? []))
  }, [open])

  async function registrar() {
    if (!servicioId) return toast.error("Elige el servicio que se hizo.")
    if (!barbero) return toast.error("Marca quién lo atendió.")
    if (!metodo) return toast.error("Marca con qué pagó.")

    setGuardando(true)
    try {
      await registrarServicioAtendido({
        servicio_id: servicioId,
        barbero,
        metodo_pago: metodo,
        fecha,
        hora,
        ...(nombre.trim() ? { nombre_cliente: nombre.trim() } : {}),
        // Sin teléfono se le carga al cliente de mostrador (lo resuelve el bot).
        ...(telefono.replace(/\D/g, "") ? { telefono_cliente: telefono.replace(/\D/g, "") } : {}),
      })
      toast.success("Servicio registrado.")
      await onRegistrado()
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof BotApiError && err.message.includes("conflicto")
          ? "Ese barbero ya tiene un servicio a esa hora — corrige la hora."
          : err instanceof BotApiError
            ? err.message
            : "No se pudo registrar el servicio.",
      )
    } finally {
      setGuardando(false)
    }
  }

  return (
    <ModalFicha
      open={open}
      onOpenChange={onOpenChange}
      mini="Cliente que llegó sin reserva"
      titulo="Registrar servicio atendido"
      ancho="sm:max-w-lg"
      pie={
        <button onClick={registrar} disabled={guardando} className="chip23 on inline-flex items-center gap-2 disabled:opacity-40">
          {guardando && <Loader2 className="size-3.5 animate-spin" />}
          Registrar
        </button>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="brand-serif">Servicio</Label>
          <select
            value={servicioId}
            onChange={(e) => setServicioId(e.target.value)}
            className="h-11 w-full border border-border bg-card px-3 text-sm outline-none focus:border-foreground"
          >
            <option value="">Elegir servicio…</option>
            {servicios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.duration} · S/ {s.price}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label className="brand-serif">¿Quién lo atendió?</Label>
          <div className="flex flex-wrap gap-2">
            {BARBEROS.map((b) => (
              <button key={b} type="button" onClick={() => setBarbero(b)} className={cn("chip23", barbero === b && "on")}>
                {b}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="brand-serif">¿Con qué pagó?</Label>
          <div className="flex flex-wrap gap-2">
            {METODOS_PAGO.map((m) => (
              <button key={m} type="button" onClick={() => setMetodo(m)} className={cn("chip23", metodo === m && "on")}>
                {METODO_PAGO_LABEL[m]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="brand-serif">Día</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="tnum h-11" />
          </div>
          <div className="space-y-1.5">
            <Label className="brand-serif">Hora</Label>
            <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="tnum h-11" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="brand-serif">Cliente (opcional)</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label className="brand-serif">WhatsApp (opcional)</Label>
            <Input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              inputMode="numeric"
              placeholder="987 654 321"
              className="tnum h-11"
            />
          </div>
        </div>
        <p className="brand-serif text-[12px] text-muted-foreground">
          Sin nombre ni WhatsApp queda como cliente de mostrador: cuenta igual en comisiones y en caja, pero no le
          arma ficha.
        </p>
      </div>
    </ModalFicha>
  )
}
