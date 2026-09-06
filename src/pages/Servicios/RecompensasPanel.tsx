import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Recompensa } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ModalFicha } from "@/components/ModalFicha"

/**
 * El programa de fidelidad, editable: cuántos cortes hacen falta y qué se
 * gana. Vive acá y no como constantes en el código porque es una decisión
 * del negocio que va a cambiar —subir el umbral, cambiar el premio por
 * temporada— y cada cambio no puede depender de un despliegue.
 *
 * Lo que el cliente ve en su cuenta del sitio sale de esta misma tabla.
 */
export default function RecompensasPanel() {
  const [recompensas, setRecompensas] = useState<Recompensa[]>([])
  const [cargando, setCargando] = useState(true)
  const [abierto, setAbierto] = useState(false)
  const [editando, setEditando] = useState<Recompensa | null>(null)

  const [cortes, setCortes] = useState("")
  const [titulo, setTitulo] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [activo, setActivo] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from("recompensas").select("*").order("cortes_requeridos")
    if (error) toast.error("No se pudieron cargar las recompensas.")
    else setRecompensas((data as Recompensa[] | null) ?? [])
    setCargando(false)
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  function abrir(r: Recompensa | null) {
    setEditando(r)
    setCortes(r ? String(r.cortes_requeridos) : "")
    setTitulo(r?.titulo ?? "")
    setDescripcion(r?.descripcion ?? "")
    setActivo(r?.activo ?? true)
    setAbierto(true)
  }

  async function guardar() {
    const n = Number(cortes)
    if (!Number.isInteger(n) || n <= 0) return toast.error("Los cortes tienen que ser un entero mayor a 0.")
    if (!titulo.trim()) return toast.error("Ponle nombre al premio.")

    setGuardando(true)
    const payload = {
      cortes_requeridos: n,
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || null,
      activo,
      updated_at: new Date().toISOString(),
    }
    const { error } = editando
      ? await supabase.from("recompensas").update(payload).eq("id", editando.id)
      : await supabase.from("recompensas").insert(payload)
    setGuardando(false)
    if (error) {
      // El único choque posible es el umbral repetido (índice único).
      toast.error(error.code === "23505" ? "Ya hay una recompensa a esa cantidad de cortes." : "No se pudo guardar.")
      return
    }
    toast.success(editando ? "Recompensa actualizada." : "Recompensa creada.")
    setAbierto(false)
    cargar()
  }

  async function eliminar(r: Recompensa) {
    if (!window.confirm(`¿Borrar "${r.titulo}"? Los clientes dejan de verla en su cuenta.`)) return
    const { error } = await supabase.from("recompensas").delete().eq("id", r.id)
    if (error) toast.error("No se pudo borrar.")
    else {
      toast.success("Recompensa borrada.")
      cargar()
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Cargando recompensas…
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Lo que el cliente ve en su cuenta del sitio: cuántos cortes lleva y qué gana al llegar.
        </p>
        <button onClick={() => abrir(null)} className="chip23 on inline-flex items-center gap-1.5">
          <Plus className="size-3" /> Nueva recompensa
        </button>
      </div>

      <div className="overflow-hidden border border-border bg-card">
        {recompensas.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-muted-foreground">
            Sin recompensas: el cliente ve su conteo de cortes, pero no hay premio al que llegar.
          </p>
        ) : (
          <ul>
            {recompensas.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-4 border-b border-border/60 px-5 py-3 last:border-b-0"
              >
                <div className="brand-wide tnum w-12 text-center text-[22px] leading-none">{r.cortes_requeridos}</div>
                <button onClick={() => abrir(r)} className="min-w-0 flex-1 text-left">
                  <div className={r.activo ? "text-sm font-semibold" : "text-sm font-semibold line-through opacity-50"}>
                    {r.titulo}
                  </div>
                  <div className="brand-serif text-[13px] text-muted-foreground">{r.descripcion ?? "Sin descripción"}</div>
                </button>
                <button
                  onClick={() => eliminar(r)}
                  title="Borrar recompensa"
                  className="text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ModalFicha
        open={abierto}
        onOpenChange={setAbierto}
        mini="Programa de fidelidad"
        titulo={editando ? "Editar recompensa" : "Nueva recompensa"}
        ancho="sm:max-w-md"
        pie={
          <button onClick={guardar} disabled={guardando} className="chip23 on disabled:opacity-40">
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="brand-serif">¿A cuántos cortes?</Label>
            <Input
              type="number"
              min={1}
              value={cortes}
              onChange={(e) => setCortes(e.target.value)}
              placeholder="5"
              className="tnum h-11 max-w-28"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="brand-serif">Premio</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Mascarilla gratis" className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label className="brand-serif">Descripción (opcional)</Label>
            <Input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="A los 5 cortes, una mascarilla facial de cortesía."
              className="h-11"
            />
          </div>
          <label className="flex items-center gap-2.5 border border-border px-3 py-2.5">
            <Switch checked={activo} onCheckedChange={setActivo} />
            <span className="brand-serif text-[13px]">Activa (visible para el cliente)</span>
          </label>
        </div>
      </ModalFicha>
    </div>
  )
}
