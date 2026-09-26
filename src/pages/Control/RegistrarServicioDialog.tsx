import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Check, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { registrarServicioAtendido, BotApiError } from "@/lib/botApi"
import { formatoSoles, precioNumerico } from "@/pages/Control/rango"
import { BARBEROS, METODOS_PAGO, METODO_PAGO_LABEL, type Barbero, type MetodoPago } from "@/lib/types"
import { ModalFicha } from "@/components/ModalFicha"
import { ClienteCombobox } from "@/components/ClienteCombobox"
import { ProgresoCliente } from "@/components/ProgresoCliente"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { normalizarTelefono } from "@/lib/clienteBusqueda"

const TZ = "America/Lima"

type Servicio = { id: string; name: string; duration: string; duration_minutes: number | null; price: string }

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
  barberoFijo,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRegistrado: () => Promise<void> | void
  /** Un barbero solo se registra sus propios servicios (lo impone también el bot): queda fijo y sin selector. */
  barberoFijo?: Barbero | null
}) {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [servicioIds, setServicioIds] = useState<string[]>([])
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
    setServicioIds([])
    setBarbero(barberoFijo ?? "")
    setMetodo(null)
    setFecha(ahora.fecha)
    setHora(ahora.hora)
    setNombre("")
    setTelefono("")
    supabase
      .from("services")
      .select("id, name, duration, duration_minutes, price")
      .eq("active", true)
      .order("sort_order")
      .then(({ data }) => setServicios((data as Servicio[] | null) ?? []))
  }, [open, barberoFijo])

  const elegidos = servicios.filter((s) => servicioIds.includes(s.id))
  const minutosTotales = elegidos.reduce((t, s) => t + (s.duration_minutes ?? 0), 0)
  const precios = elegidos.map((s) => precioNumerico(s.price))
  const totalSoles = precios.reduce<number>((t, p) => t + (p ?? 0), 0)
  const hayPrecioSinNumero = precios.some((p) => p == null)

  function alternar(id: string) {
    setServicioIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const reloj = (total: number) => {
    const hh = Math.floor((total % 1440) / 60)
    const mm = total % 60
    return `${String(hh % 12 || 12).padStart(2, "0")}:${String(mm).padStart(2, "0")} ${hh < 12 ? "a. m." : "p. m."}`
  }

  /** Tramo que se bloquea, en hora de pared ("06:48 p. m. a 10:18 p. m."). */
  function tramoOcupado(): string | null {
    const [h, m] = hora.split(":").map(Number)
    if (h == null || m == null || Number.isNaN(h) || Number.isNaN(m) || minutosTotales === 0) return null
    const inicio = h * 60 + m
    const fin = inicio + minutosTotales
    return `${reloj(inicio)} a ${reloj(fin)}${fin >= 1440 ? " (día siguiente)" : ""}`
  }

  function duracionTexto(min: number) {
    const h = Math.floor(min / 60)
    const m = min % 60
    return h > 0 ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`
  }

  async function registrar() {
    if (servicioIds.length === 0) return toast.error("Elige al menos un servicio.")
    if (!barbero) return toast.error("Marca quién lo atendió.")
    if (!metodo) return toast.error("Marca con qué pagó.")

    setGuardando(true)
    try {
      await registrarServicioAtendido({
        servicio_ids: servicioIds,
        barbero,
        metodo_pago: metodo,
        fecha,
        hora,
        ...(nombre.trim() ? { nombre_cliente: nombre.trim() } : {}),
        // Sin teléfono se le carga al cliente de mostrador (lo resuelve el bot).
        // Normalizado con el prefijo 51: sin esto, un walk-in y una reserva
        // web del mismo número terminaban en dos fichas de cliente distintas.
        ...(telefono.replace(/\D/g, "") ? { telefono_cliente: normalizarTelefono(telefono) } : {}),
      })
      toast.success("Servicio registrado.")
      await onRegistrado()
      onOpenChange(false)
    } catch (err) {
      // El bot ya manda el motivo concreto (servicio sin duración, choque de
      // horario, permisos): mostrarlo tal cual evita el "no se pudo" a secas.
      toast.error(err instanceof BotApiError ? err.message : "No se pudo registrar el servicio.")
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
        <div className="space-y-2">
          <Label className="brand-serif">Servicios realizados</Label>
          {/* Sin minutos cargados el bot no puede calcular cuánto tiempo bloquea, así
              que ese servicio no se puede marcar hasta ponerle la duración en Servicios. */}
          <div className="max-h-56 space-y-1 overflow-y-auto border border-border bg-card p-1.5">
            {servicios.map((s) => {
              const marcado = servicioIds.includes(s.id)
              const sinDuracion = s.duration_minutes == null
              return (
                <button
                  key={s.id}
                  type="button"
                  role="checkbox"
                  aria-checked={marcado}
                  disabled={sinDuracion}
                  onClick={() => alternar(s.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40",
                    marcado && "bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center border border-foreground",
                      marcado && "bg-foreground text-background",
                    )}
                  >
                    {marcado && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="tnum shrink-0 text-xs text-muted-foreground">
                    {sinDuracion ? "falta duración" : duracionTexto(s.duration_minutes!)} · S/ {s.price}
                  </span>
                </button>
              )
            })}
          </div>
          {elegidos.length > 0 && (
            <div className="brand-serif flex flex-wrap justify-between gap-x-4 text-[13px] text-muted-foreground">
              <span>
                {elegidos.length} servicio{elegidos.length === 1 ? "" : "s"} · {duracionTexto(minutosTotales)}
                {tramoOcupado() && <> · ocupa de {tramoOcupado()}</>}
              </span>
              <span className="text-foreground">
                {totalSoles > 0 ? formatoSoles(totalSoles) : ""}
                {hayPrecioSinNumero && (totalSoles > 0 ? " + consultar" : "Precio a consultar")}
              </span>
            </div>
          )}
        </div>

        {!barberoFijo && (
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
        )}

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
            <ClienteCombobox
              value={nombre}
              onChange={setNombre}
              onSeleccionar={(c) => {
                setTelefono(c.telefono)
              }}
              className="h-11"
            />
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
        <ProgresoCliente telefono={telefono} />
        <p className="brand-serif text-[12px] text-muted-foreground">
          Sin nombre ni WhatsApp queda como cliente de mostrador: cuenta igual en comisiones y en caja, pero no le
          arma ficha.
        </p>
      </div>
    </ModalFicha>
  )
}
