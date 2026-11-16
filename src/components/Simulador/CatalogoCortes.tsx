import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { ImagePlus, Loader2, Trash2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { FORMAS_ROSTRO, TIPOS_CABELLO, etiquetaForma, type CorteReferencia } from "@/lib/simulador"

const BUCKET = "cortes-referencia"

const urlPublica = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

function Chips<T extends string>({
  opciones,
  valor,
  onChange,
}: {
  opciones: readonly { id: T; label: string }[]
  valor: T[]
  onChange: (v: T[]) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opciones.map((o) => {
        const activo = valor.includes(o.id)
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(activo ? valor.filter((v) => v !== o.id) : [...valor, o.id])}
            className={cn(
              "border px-2.5 py-1 text-xs transition-colors",
              activo ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted",
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Catálogo de cortes del simulador. Cada corte lleva la foto de una persona con ese corte (ideal: un trabajo real de
 * Cieza) y las formas de rostro a las que les queda; el análisis solo recomienda de acá, y esa foto es la que se usa
 * como referencia al poner el corte sobre el cliente.
 */
export function CatalogoCortes() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [cortes, setCortes] = useState<CorteReferencia[] | null>(null)
  const [migrada, setMigrada] = useState(true)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [nombre, setNombre] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [formas, setFormas] = useState<string[]>([])
  const [cabellos, setCabellos] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    const { data, error } = await supabase
      .from("cortes_referencia")
      .select("*")
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true })
    if (error) {
      // 42P01 / PGRST205: la migración 0033 aún no se corrió.
      if (error.code === "42P01" || error.code === "PGRST205") setMigrada(false)
      else toast.error("No se pudo cargar el catálogo.")
      setCortes([])
      return
    }
    setCortes((data ?? []) as CorteReferencia[])
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function agregar(e: FormEvent) {
    e.preventDefault()
    if (!archivo || !nombre.trim() || formas.length === 0) return
    setGuardando(true)
    const extension = archivo.name.split(".").pop()?.toLowerCase() || "jpg"
    const path = `${crypto.randomUUID()}.${extension}`
    const { error: errorSubida } = await supabase.storage
      .from(BUCKET)
      .upload(path, archivo, { contentType: archivo.type || undefined })
    if (errorSubida) {
      setGuardando(false)
      toast.error("No se pudo subir la foto.")
      return
    }
    const { error } = await supabase.from("cortes_referencia").insert({
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      formas_rostro: formas,
      tipos_cabello: cabellos,
      storage_path: path,
      orden: cortes?.length ?? 0,
    })
    setGuardando(false)
    if (error) {
      await supabase.storage.from(BUCKET).remove([path])
      toast.error("No se pudo guardar el corte.")
      return
    }
    toast.success("Corte agregado al catálogo.")
    setArchivo(null)
    setNombre("")
    setDescripcion("")
    setFormas([])
    setCabellos([])
    if (fileRef.current) fileRef.current.value = ""
    cargar()
  }

  async function alternar(c: CorteReferencia) {
    const { error } = await supabase.from("cortes_referencia").update({ activo: !c.activo }).eq("id", c.id)
    if (error) toast.error("No se pudo actualizar.")
    else cargar()
  }

  async function borrar(c: CorteReferencia) {
    if (!window.confirm(`¿Borrar «${c.nombre}» del catálogo? No se puede deshacer.`)) return
    const { error } = await supabase.from("cortes_referencia").delete().eq("id", c.id)
    if (error) {
      toast.error("No se pudo borrar.")
      return
    }
    await supabase.storage.from(BUCKET).remove([c.storage_path])
    toast.success("Corte borrado.")
    cargar()
  }

  if (!migrada) {
    return (
      <p className="bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        Falta correr la migración <code>0033_simulador_cortes.sql</code> en el SQL editor de Supabase.
      </p>
    )
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={agregar} className="grid gap-4 border border-border bg-card p-4 md:grid-cols-[180px_1fr]">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex aspect-[3/4] items-center justify-center overflow-hidden border border-dashed border-border text-xs text-muted-foreground hover:bg-muted"
        >
          {archivo ? (
            <img src={URL.createObjectURL(archivo)} alt="" className="size-full object-cover" />
          ) : (
            <span className="grid justify-items-center gap-1">
              <ImagePlus className="size-5" />
              Foto del corte
            </span>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
        />
        <div className="grid content-start gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="corte-nombre">Nombre del corte</Label>
            <Input id="corte-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Mid fade con textura" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="corte-desc">Descripción (opcional)</Label>
            <Input
              id="corte-desc"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej. Degradado medio, arriba 5 cm con textura, raya marcada"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>¿A qué formas de rostro les queda?</Label>
            <Chips opciones={FORMAS_ROSTRO} valor={formas} onChange={setFormas} />
          </div>
          <div className="grid gap-1.5">
            <Label>Tipo de cabello (opcional: vacío = cualquiera)</Label>
            <Chips opciones={TIPOS_CABELLO} valor={cabellos} onChange={setCabellos} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Usa una foto de frente o de tres cuartos donde se vea bien el corte. Si es de un cliente, que haya dado
            permiso: esta foto se le muestra a otros clientes.
          </p>
          <Button
            type="submit"
            disabled={!archivo || !nombre.trim() || formas.length === 0 || guardando}
            className="justify-self-start"
          >
            {guardando && <Loader2 className="size-4 animate-spin" />}
            Agregar al catálogo
          </Button>
        </div>
      </form>

      {cortes === null ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4]" />
          ))}
        </div>
      ) : cortes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay cortes. Mientras tanto el simulador recomienda por nombre, sin foto de referencia.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {cortes.map((c) => (
            <article key={c.id} className={cn("grid content-start gap-2 border border-border bg-card p-2", !c.activo && "opacity-50")}>
              <img src={urlPublica(c.storage_path)} alt={c.nombre} className="aspect-[3/4] w-full object-cover" />
              <div>
                <h4 className="text-sm font-semibold leading-tight">{c.nombre}</h4>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{c.formas_rostro.map(etiquetaForma).join(" · ")}</p>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs">
                  <Switch checked={c.activo} onCheckedChange={() => alternar(c)} />
                  {c.activo ? "Activo" : "Oculto"}
                </label>
                <Button variant="ghost" size="icon" aria-label={`Borrar ${c.nombre}`} onClick={() => borrar(c)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
