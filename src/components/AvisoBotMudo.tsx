import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { supabase } from "@/lib/supabase"

/**
 * Cuántas horas sin un solo mensaje entrante son sospechosas. De noche no
 * escribe nadie, así que un umbral corto daría falsas alarmas; 12 horas
 * cubre la madrugada más larga sin dejar pasar un día de trabajo entero.
 */
const HORAS_SIN_MENSAJES = 12

/**
 * Avisa cuando el bot lleva horas sin recibir un mensaje de WhatsApp.
 *
 * Pasó de verdad: Meta desactivó la suscripción del webhook tras varios
 * despliegues seguidos y el bot estuvo tres días sin recibir NADA, sin que
 * nadie se enterara — los clientes escribían al vacío. El bot no puede
 * detectarlo por su cuenta (un webhook que no llega no deja rastro), así que
 * la única señal es el silencio mismo: si hace medio día que no entra un
 * mensaje, algo está roto.
 */
export function AvisoBotMudo() {
  const [horasEnSilencio, setHorasEnSilencio] = useState<number | null>(null)

  useEffect(() => {
    let activo = true

    async function revisar() {
      const { data, error } = await supabase
        .from("mensajes")
        .select("created_at")
        .eq("rol", "user")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!activo || error || !data) return

      const horas = (Date.now() - new Date(data.created_at as string).getTime()) / 3_600_000
      setHorasEnSilencio(horas >= HORAS_SIN_MENSAJES ? horas : null)
    }

    revisar()
    // Se revisa cada media hora: es un problema de horas, no de segundos.
    const id = setInterval(revisar, 30 * 60_000)
    return () => {
      activo = false
      clearInterval(id)
    }
  }, [])

  if (horasEnSilencio == null) return null

  const texto =
    horasEnSilencio >= 48
      ? `${Math.floor(horasEnSilencio / 24)} días`
      : `${Math.floor(horasEnSilencio)} horas`

  return (
    <div className="flex items-start gap-2.5 border-b border-[var(--status-pending)] bg-[var(--status-pending-bg)] px-6 py-3">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--status-pending)]" />
      <div className="text-[13px]">
        <span className="font-semibold">Hace {texto} que no llega ningún WhatsApp.</span>{" "}
        <span className="text-muted-foreground">
          Puede que Meta haya desactivado el webhook: los clientes estarían escribiendo sin que nadie los vea. Revisa
          WhatsApp → Configuración → Webhook en developers.facebook.com y que el campo <code>messages</code> siga
          suscrito.
        </span>
      </div>
    </div>
  )
}
