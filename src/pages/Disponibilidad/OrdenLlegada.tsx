import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Configuracion } from "@/lib/availabilityTypes"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/** Lo mismo que dice el bot si no se escribe otro texto (bot/src/db/repositories/configuracion.ts). */
const MENSAJE_POR_DEFECTO =
  "Por la campaña de fin de año atendemos por orden de llegada: no se separa hora. Ven directo al local " +
  "(Jr. Manuel Gonzales Prada 875, Los Olivos), todos los días de 10:00 a. m. a 9:00 p. m., y te atendemos en el " +
  "orden en que llegues."

/**
 * Campaña «atención por orden de llegada»: encendida, nadie elige hora. La web de reservas muestra solo el aviso, el
 * bot de WhatsApp deja de ofrecer y agendar horarios y responde con este mismo texto. Las citas ya confirmadas se
 * mantienen. Aquí mismo se apaga cuando termina la campaña.
 */
export default function OrdenLlegada() {
  const [activa, setActiva] = useState(false)
  const [mensaje, setMensaje] = useState("")
  const [guardado, setGuardado] = useState("")
  const [migrada, setMigrada] = useState(true)
  const [loading, setLoading] = useState(true)
  const [cambiando, setCambiando] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let vivo = true
    async function cargar() {
      const { data, error } = await supabase.from("configuracion").select("*").single()
      if (!vivo) return
      if (error || !data) toast.error("No se pudo cargar el modo de atención.")
      else {
        const c = data as Configuracion
        // Sin la migración 0032 la fila no trae la columna.
        setMigrada("orden_llegada" in c)
        setActiva(c.orden_llegada === true)
        setMensaje(c.orden_llegada_mensaje ?? "")
        setGuardado(c.orden_llegada_mensaje ?? "")
      }
      setLoading(false)
    }
    cargar()
    return () => {
      vivo = false
    }
  }, [])

  async function alternar(valor: boolean) {
    setCambiando(true)
    const { error } = await supabase.from("configuracion").update({ orden_llegada: valor }).eq("id", true)
    setCambiando(false)
    if (error) {
      toast.error("No se pudo cambiar. Intenta de nuevo.")
      return
    }
    setActiva(valor)
    toast.success(valor ? "Campaña encendida: nadie puede elegir hora." : "Campaña apagada: vuelven las reservas con hora.")
  }

  async function guardarMensaje() {
    setGuardando(true)
    const limpio = mensaje.trim()
    const { error } = await supabase.from("configuracion").update({ orden_llegada_mensaje: limpio || null }).eq("id", true)
    setGuardando(false)
    if (error) {
      toast.error("No se pudo guardar el mensaje.")
      return
    }
    setGuardado(limpio)
    setMensaje(limpio)
    toast.success("Mensaje guardado.")
  }

  if (loading) {
    return (
      <section className="mb-8">
        <Skeleton className="h-32 w-full" />
      </section>
    )
  }

  return (
    <section className={cn("mb-8 rounded-lg border bg-card p-5", activa ? "border-amber-500/60" : "border-border")}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            Atención por orden de llegada
            {activa && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                Activa
              </span>
            )}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Para campañas (fin de año): con esto encendido <strong>nadie elige hora</strong>. La web de reservas muestra
            solo el aviso y el bot de WhatsApp no ofrece ni agenda horarios. Las citas ya confirmadas se mantienen y las
            que registres tú aquí en el panel siguen funcionando.
          </p>
        </div>
        <Switch
          checked={activa}
          onCheckedChange={alternar}
          disabled={cambiando || !migrada}
          aria-label="Atención por orden de llegada"
        />
      </div>

      {!migrada && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Falta correr la migración <strong>0032_orden_llegada.sql</strong> en Supabase para poder encender esto.
        </p>
      )}

      <div className="mt-4 space-y-1.5">
        <label htmlFor="orden-llegada-mensaje" className="text-xs font-medium">
          Lo que se le dice a la clienta
        </label>
        <Textarea
          id="orden-llegada-mensaje"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder={MENSAJE_POR_DEFECTO}
          rows={3}
          disabled={!migrada}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">Vacío = el texto de arriba (gris). Lo ven la web y el bot.</p>
          <button
            type="button"
            onClick={guardarMensaje}
            disabled={guardando || !migrada || mensaje.trim() === guardado}
            className="chip23 inline-flex items-center gap-1.5 disabled:opacity-40"
          >
            {guardando && <Loader2 className="size-3.5 animate-spin" />}
            Guardar mensaje
          </button>
        </div>
      </div>
    </section>
  )
}
