import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Info, Plus, Trash2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { eliminarBloqueo as eliminarBloqueoBot, BotApiError } from "@/lib/botApi"
import type { Bloqueo } from "@/lib/availabilityTypes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * <input type="datetime-local"> no trae zona horaria: el valor se interpreta
 * como hora local del navegador. Como el staff opera desde Lima, coincide
 * con BUSINESS_TIMEZONE del bot — así que new Date(valor).toISOString() da
 * el UTC correcto sin conversión manual.
 */
function localInputToUtcIso(valorLocal: string): string {
  return new Date(valorLocal).toISOString()
}

function formatearRango(inicioUtc: string, finUtc: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
  const inicio = new Date(inicioUtc).toLocaleString("es-PE", opts)
  const fin = new Date(finUtc).toLocaleString("es-PE", { hour: "2-digit", minute: "2-digit" })
  return `${inicio} – ${fin}`
}

export default function Bloqueos() {
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([])
  const [loading, setLoading] = useState(true)
  const [creando, setCreando] = useState(false)
  const [inicio, setInicio] = useState("")
  const [fin, setFin] = useState("")
  const [motivo, setMotivo] = useState("")

  useEffect(() => {
    let activo = true

    async function cargar() {
      const { data, error } = await supabase
        .from("bloqueos")
        .select("*")
        .gte("fin_utc", new Date().toISOString())
        .order("inicio_utc")
      if (!activo) return
      if (error) toast.error("No se pudieron cargar los bloqueos.")
      else setBloqueos(data as Bloqueo[])
      setLoading(false)
    }
    cargar()

    const canal = supabase
      .channel("disponibilidad-bloqueos")
      .on("postgres_changes", { event: "*", schema: "public", table: "bloqueos" }, () => cargar())
      .subscribe()

    return () => {
      activo = false
      supabase.removeChannel(canal)
    }
  }, [])

  async function crear(e: FormEvent) {
    e.preventDefault()
    if (!inicio || !fin || !motivo.trim()) return

    const inicioUtc = localInputToUtcIso(inicio)
    const finUtc = localInputToUtcIso(fin)
    if (finUtc <= inicioUtc) {
      toast.error("La hora de fin debe ser posterior a la de inicio.")
      return
    }

    setCreando(true)
    const { error } = await supabase.from("bloqueos").insert({ inicio_utc: inicioUtc, fin_utc: finUtc, motivo: motivo.trim() })
    setCreando(false)

    if (error) {
      toast.error("No se pudo crear el bloqueo.")
      return
    }
    toast.success("Bloqueo creado.")
    setInicio("")
    setFin("")
    setMotivo("")
  }

  async function eliminar(id: string) {
    const previos = bloqueos
    setBloqueos((b) => b.filter((x) => x.id !== id))
    try {
      // Vía el bot, no un delete directo: si el bloqueo vino de un evento
      // externo de Calendar, el bot borra también ese evento — un delete
      // directo a Supabase lo dejaba huérfano en el calendario.
      await eliminarBloqueoBot(id)
    } catch (err) {
      setBloqueos(previos)
      toast.error(err instanceof BotApiError ? err.message : "No se pudo quitar el bloqueo.")
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-1 text-sm font-semibold">Bloqueos puntuales</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Cierra un rango específico dentro del horario normal — vacaciones, un feriado, salir antes un día. No
        agrega horas extra fuera del horario semanal, solo quita disponibilidad.
      </p>

      <form onSubmit={crear} className="mb-5 flex flex-wrap items-end gap-3 rounded-md bg-muted/50 p-3">
        <div className="grid gap-1">
          <Label htmlFor="bloqueo-inicio" className="text-xs">
            Desde
          </Label>
          <Input
            id="bloqueo-inicio"
            type="datetime-local"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            className="h-8 text-xs"
            required
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="bloqueo-fin" className="text-xs">
            Hasta
          </Label>
          <Input
            id="bloqueo-fin"
            type="datetime-local"
            value={fin}
            onChange={(e) => setFin(e.target.value)}
            className="h-8 text-xs"
            required
          />
        </div>
        <div className="grid min-w-40 flex-1 gap-1">
          <Label htmlFor="bloqueo-motivo" className="text-xs">
            Motivo
          </Label>
          <Input
            id="bloqueo-motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej. Feriado, vacaciones…"
            className="h-8 text-xs"
            required
          />
        </div>
        <Button type="submit" size="sm" className="h-8 gap-1" disabled={creando}>
          <Plus className="size-3.5" />
          Bloquear
        </Button>
      </form>

      {loading ? (
        <Skeleton className="h-16 w-full" />
      ) : bloqueos.length === 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="size-3.5" />
          Sin bloqueos próximos.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {bloqueos.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 py-2">
              <div>
                <div className="text-sm font-medium capitalize">{formatearRango(b.inicio_utc, b.fin_utc)}</div>
                <div className="text-xs text-muted-foreground">{b.motivo}</div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-muted-foreground hover:text-destructive"
                onClick={() => eliminar(b.id)}
                aria-label="Quitar bloqueo"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
