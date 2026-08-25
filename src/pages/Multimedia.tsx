import { useEffect, useRef, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { FileText, Music, Trash2, Upload } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { TIPO_MEDIA_LABEL, type PlantillaMedia, type TipoMedia } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"

const MIME_A_TIPO: Record<string, TipoMedia> = { image: "image", video: "video", audio: "audio" }

function tipoDeArchivo(file: File): TipoMedia {
  const prefijo = file.type.split("/")[0]
  return MIME_A_TIPO[prefijo ?? ""] ?? "document"
}

function urlPublica(path: string): string {
  return supabase.storage.from("plantillas-media").getPublicUrl(path).data.publicUrl
}

function Preview({ tipo, url }: { tipo: TipoMedia; url: string }) {
  if (tipo === "image") return <img src={url} alt="" className="h-full w-full object-cover" />
  if (tipo === "video") return <video src={url} className="h-full w-full object-cover" muted />
  if (tipo === "audio")
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted">
        <Music className="size-6 text-muted-foreground" />
      </div>
    )
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <FileText className="size-6 text-muted-foreground" />
    </div>
  )
}

export default function Multimedia() {
  const [plantillas, setPlantillas] = useState<PlantillaMedia[]>([])
  const [loading, setLoading] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [nombre, setNombre] = useState("")
  const [descripcionUso, setDescripcionUso] = useState("")
  const [caption, setCaption] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let activo = true

    async function cargar() {
      const { data, error } = await supabase.from("plantillas_media").select("*").order("created_at", { ascending: false })
      if (!activo) return
      if (error) toast.error("No se pudo cargar la biblioteca multimedia.")
      else setPlantillas(data as PlantillaMedia[])
      setLoading(false)
    }
    cargar()

    const canal = supabase
      .channel("multimedia-plantillas")
      .on("postgres_changes", { event: "*", schema: "public", table: "plantillas_media" }, () => cargar())
      .subscribe()

    return () => {
      activo = false
      supabase.removeChannel(canal)
    }
  }, [])

  async function subir(e: FormEvent) {
    e.preventDefault()
    if (!archivo || !nombre.trim() || !descripcionUso.trim()) return

    setSubiendo(true)
    const tipo = tipoDeArchivo(archivo)
    const extension = archivo.name.split(".").pop() ?? "bin"
    const path = `${crypto.randomUUID()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from("plantillas-media")
      .upload(path, archivo, { contentType: archivo.type || undefined })
    if (uploadError) {
      setSubiendo(false)
      toast.error("No se pudo subir el archivo.")
      return
    }

    const { error } = await supabase.from("plantillas_media").insert({
      nombre: nombre.trim(),
      tipo,
      storage_path: path,
      descripcion_uso: descripcionUso.trim(),
      caption: caption.trim() || null,
    })
    setSubiendo(false)

    if (error) {
      toast.error("Se subió el archivo pero no se pudo guardar la plantilla.")
      return
    }
    toast.success("Multimedia agregada.")
    setArchivo(null)
    setNombre("")
    setDescripcionUso("")
    setCaption("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function alternarActivo(p: PlantillaMedia) {
    const { error } = await supabase.from("plantillas_media").update({ activo: !p.activo }).eq("id", p.id)
    if (error) toast.error("No se pudo actualizar.")
  }

  async function eliminar(p: PlantillaMedia) {
    const previas = plantillas
    setPlantillas((rows) => rows.filter((r) => r.id !== p.id))
    const { error } = await supabase.from("plantillas_media").delete().eq("id", p.id)
    if (error) {
      setPlantillas(previas)
      toast.error("No se pudo eliminar.")
      return
    }
    // Best-effort: si falla, queda un archivo huérfano en el bucket, no crítico.
    await supabase.storage.from("plantillas-media").remove([p.storage_path])
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Multimedia</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Imágenes, videos y audios que el bot puede enviar solo en WhatsApp, o que tú mandas a mano desde una
          conversación. La descripción de uso es lo que lee el bot para decidir cuándo mandar cada una.
        </p>
      </div>

      <form onSubmit={subir} className="mb-8 flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
        <div className="grid gap-1.5">
          <Label htmlFor="mm-archivo" className="text-xs">
            Archivo
          </Label>
          <input
            ref={fileInputRef}
            id="mm-archivo"
            type="file"
            accept="image/*,video/*,audio/*,application/pdf"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            className="text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-xs file:font-medium"
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="mm-nombre" className="text-xs">
            Nombre
          </Label>
          <Input
            id="mm-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Catálogo de precios"
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="mm-uso" className="text-xs">
            ¿Cuándo debe usarla el bot?
          </Label>
          <Textarea
            id="mm-uso"
            value={descripcionUso}
            onChange={(e) => setDescripcionUso(e.target.value)}
            rows={2}
            placeholder="Ej. Cuando la clienta pregunte por precios de todos los servicios juntos."
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="mm-caption" className="text-xs">
            Texto que acompaña el envío (opcional)
          </Label>
          <Input
            id="mm-caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Se muestra junto a la imagen/video en WhatsApp"
          />
        </div>
        <Button type="submit" className="w-fit gap-1.5" disabled={subiendo || !archivo}>
          <Upload className="size-4" />
          {subiendo ? "Subiendo…" : "Agregar a la biblioteca"}
        </Button>
      </form>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : plantillas.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Todavía no hay nada en la biblioteca.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {plantillas.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="aspect-video bg-muted">
                <Preview tipo={p.tipo} url={urlPublica(p.storage_path)} />
              </div>
              <div className="flex flex-col gap-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{p.nombre}</div>
                    <div className="text-xs text-muted-foreground">{TIPO_MEDIA_LABEL[p.tipo]}</div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => eliminar(p)}
                    aria-label={`Eliminar ${p.nombre}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">{p.descripcion_uso}</p>
                <label className="mt-1 flex items-center gap-2 text-xs">
                  <Switch checked={p.activo} onCheckedChange={() => alternarActivo(p)} />
                  {p.activo ? "Activa" : "Inactiva"}
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

