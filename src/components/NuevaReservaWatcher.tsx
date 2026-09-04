import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { CalendarPlus } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useServiceNames } from "@/lib/services"

type CitaRealtime = {
  id: string
  cliente_id: string
  servicio_id: string
  inicio_utc: string
  estado: string
  barbero: string | null
}

/** "lun 1 de sep, 3:00 p. m." — Lima, igual formato que usa el resto del panel. */
function formatearFecha(inicioUtc: string): string {
  const fecha = new Date(inicioUtc)
  const dia = fecha.toLocaleDateString("es-PE", {
    timeZone: "America/Lima",
    weekday: "short",
    day: "numeric",
    month: "short",
  })
  const hora = fecha.toLocaleTimeString("es-PE", { timeZone: "America/Lima", hour: "numeric", minute: "2-digit" })
  return `${dia}, ${hora}`
}

/** Beep corto sintetizado — sin archivo de audio que mantener. */
function reproducirAviso() {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = "sine"
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start()
    osc.stop(ctx.currentTime + 0.42)
    osc.onended = () => ctx.close()
  } catch {
    // Navegador sin Web Audio, o bloqueado por política de autoplay antes de
    // cualquier interacción: el toast igual se ve, el sonido es un extra.
  }
}

/**
 * Aviso global (montado en AppShell, así que se ve desde cualquier página del
 * panel) cuando una cita pasa a estar REALMENTE confirmada — no en el
 * instante en que se crea un stand-by por adelanto, que puede liberarse solo
 * en minutos si el cliente no paga. Mismo criterio de "recién confirmada" que
 * usa el aviso por WhatsApp al dueño en el bot (avisarDuenoNuevaCita):
 *   - INSERT con estado ya 'confirmada' (reserva sin adelanto pendiente).
 *   - UPDATE que pasa de otro estado a 'confirmada' (se validó el adelanto).
 */
export function NuevaReservaWatcher() {
  const { serviceName } = useServiceNames()
  // Evita un toast doble en React StrictMode (monta/desmonta el efecto una
  // vez de más en desarrollo) y da acceso al valor más fresco de
  // serviceName sin reabrir el canal cada vez que el catálogo cambia.
  const serviceNameRef = useRef(serviceName)
  serviceNameRef.current = serviceName

  useEffect(() => {
    async function avisar(cita: CitaRealtime) {
      const { data: cliente } = await supabase
        .from("clientes")
        .select("nombre, telefono")
        .eq("id", cita.cliente_id)
        .maybeSingle()

      const nombre = (cliente?.nombre as string | null)?.trim() || (cliente?.telefono as string | undefined) || "Cliente"
      const servicio = serviceNameRef.current(cita.servicio_id)

      reproducirAviso()
      toast.success(`Nueva cita: ${servicio}`, {
        icon: <CalendarPlus className="size-4" />,
        description: `${nombre} · ${formatearFecha(cita.inicio_utc)}${cita.barbero ? ` · ${cita.barbero}` : ""}`,
        duration: 8000,
      })
    }

    const channel = supabase
      .channel("nueva-reserva-global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "citas" },
        (payload) => {
          const cita = payload.new as CitaRealtime
          if (cita.estado === "confirmada") void avisar(cita)
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "citas" },
        (payload) => {
          const anterior = payload.old as Partial<CitaRealtime>
          const actual = payload.new as CitaRealtime
          if (anterior.estado !== "confirmada" && actual.estado === "confirmada") void avisar(actual)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return null
}
