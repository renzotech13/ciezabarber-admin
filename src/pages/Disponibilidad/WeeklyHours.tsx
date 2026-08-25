import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Plus, X } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { DIAS_SEMANA, type BusinessHourRow } from "@/lib/availabilityTypes"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

const DEFAULT_OPEN = "09:00"
const DEFAULT_CLOSE = "13:00"

export default function WeeklyHours() {
  const [filas, setFilas] = useState<BusinessHourRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let activo = true

    async function cargar() {
      const { data, error } = await supabase
        .from("business_hours")
        .select("*")
        .order("weekday")
        .order("opens_at")
      if (!activo) return
      if (error) toast.error("No se pudo cargar el horario semanal.")
      else setFilas(data as BusinessHourRow[])
      setLoading(false)
    }
    cargar()

    const canal = supabase
      .channel("disponibilidad-business-hours")
      .on("postgres_changes", { event: "*", schema: "public", table: "business_hours" }, () => cargar())
      .subscribe()

    return () => {
      activo = false
      supabase.removeChannel(canal)
    }
  }, [])

  const porDia = useMemo(() => {
    const mapa = new Map<number, BusinessHourRow[]>()
    for (const fila of filas) {
      const actuales = mapa.get(fila.weekday) ?? []
      actuales.push(fila)
      mapa.set(fila.weekday, actuales)
    }
    return mapa
  }, [filas])

  async function agregarBloque(weekday: number) {
    const { error } = await supabase
      .from("business_hours")
      .insert({ weekday, opens_at: DEFAULT_OPEN, closes_at: DEFAULT_CLOSE })
    if (error) toast.error("No se pudo agregar el bloque de horario.")
  }

  async function quitarBloque(id: string) {
    const previas = filas
    setFilas((f) => f.filter((fila) => fila.id !== id))
    const { error } = await supabase.from("business_hours").delete().eq("id", id)
    if (error) {
      setFilas(previas)
      toast.error("No se pudo quitar el bloque de horario.")
    }
  }

  async function actualizarHora(id: string, campo: "opens_at" | "closes_at", valor: string) {
    if (!valor) return
    setFilas((f) => f.map((fila) => (fila.id === id ? { ...fila, [campo]: valor } : fila)))
    const { error } = await supabase
      .from("business_hours")
      .update({ [campo]: valor })
      .eq("id", id)
    if (error) toast.error("No se pudo guardar el horario. Revisa que abra antes de cerrar.")
  }

  if (loading) {
    return (
      <section className="mb-8">
        <Skeleton className="h-40 w-full" />
      </section>
    )
  }

  return (
    <section className="mb-8 rounded-lg border border-border bg-card p-5">
      <h2 className="mb-1 text-sm font-semibold">Horario semanal</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Se repite cada semana. Un día sin bloques queda cerrado para agendar. Puedes agregar más de un bloque por
        día (ej. mañana y tarde, con un corte al mediodía).
      </p>

      <div className="flex flex-col divide-y divide-border">
        {DIAS_SEMANA.map((nombre, weekday) => {
          const bloques = porDia.get(weekday) ?? []
          return (
            <div key={weekday} className="flex flex-wrap items-center gap-3 py-3">
              <span className="w-24 shrink-0 text-sm font-medium">{nombre}</span>

              {bloques.length === 0 ? (
                <span className="text-xs text-muted-foreground italic">Cerrado</span>
              ) : (
                <div className="flex flex-1 flex-wrap gap-2">
                  {bloques.map((bloque) => (
                    <div key={bloque.id} className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1">
                      <input
                        type="time"
                        value={bloque.opens_at.slice(0, 5)}
                        onChange={(e) => actualizarHora(bloque.id, "opens_at", e.target.value)}
                        className="w-[6.5rem] bg-transparent text-xs outline-none"
                      />
                      <span className="text-xs text-muted-foreground">–</span>
                      <input
                        type="time"
                        value={bloque.closes_at.slice(0, 5)}
                        onChange={(e) => actualizarHora(bloque.id, "closes_at", e.target.value)}
                        className="w-[6.5rem] bg-transparent text-xs outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => quitarBloque(bloque.id)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Quitar bloque de ${nombre}`}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="ml-auto h-7 gap-1 px-2 text-xs"
                onClick={() => agregarBloque(weekday)}
              >
                <Plus className="size-3.5" />
                Bloque
              </Button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
