import { useEffect, useState } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import type { Configuracion } from "@/lib/availabilityTypes"
import { Skeleton } from "@/components/ui/skeleton"

export default function Recordatorios() {
  const [horas, setHoras] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let activo = true

    async function cargar() {
      const { data, error } = await supabase.from("configuracion").select("*").single()
      if (!activo) return
      if (error) toast.error("No se pudo cargar la configuración de recordatorios.")
      else setHoras((data as Configuracion).recordatorio_horas_antes)
      setLoading(false)
    }
    cargar()

    const canal = supabase
      .channel("disponibilidad-configuracion")
      .on("postgres_changes", { event: "*", schema: "public", table: "configuracion" }, () => cargar())
      .subscribe()

    return () => {
      activo = false
      supabase.removeChannel(canal)
    }
  }, [])

  async function guardar(valor: number) {
    if (!Number.isInteger(valor) || valor < 1) return
    setHoras(valor)
    setGuardando(true)
    const { error } = await supabase.from("configuracion").update({ recordatorio_horas_antes: valor }).eq("id", true)
    setGuardando(false)
    if (error) toast.error("No se pudo guardar. Intenta de nuevo.")
    else toast.success("Listo, se guardó el nuevo aviso.")
  }

  if (loading) {
    return (
      <section className="mb-8">
        <Skeleton className="h-24 w-full" />
      </section>
    )
  }

  return (
    <section className="mb-8 rounded-lg border border-border bg-card p-5">
      <h2 className="mb-1 text-sm font-semibold">Recordatorios</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        El bot le avisa a la clienta por WhatsApp antes de su cita, el mismo día. Define con cuántas horas de
        anticipación.
      </p>

      <label className="flex items-center gap-2 text-sm">
        Avisar
        <input
          type="number"
          min={1}
          max={12}
          value={horas ?? 1}
          disabled={guardando}
          onChange={(e) => guardar(Number(e.target.value))}
          className="w-16 rounded-md border border-border bg-transparent px-2 py-1 text-center text-sm outline-none"
        />
        hora{horas !== 1 ? "s" : ""} antes de la cita
      </label>
    </section>
  )
}
