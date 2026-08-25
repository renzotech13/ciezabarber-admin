import { useRef, useState, type ChangeEvent } from "react"
import { toast } from "sonner"
import { ImageOff, Images, Upload, X } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const BUCKET = "site-media"

type GalleryFile = { name: string; url: string }

export function ImagePicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: string | null
  onChange: (url: string | null) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [galleryFiles, setGalleryFiles] = useState<GalleryFile[]>([])

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setUploading(true)
    const ext = file.name.split(".").pop()
    const path = `${crypto.randomUUID()}${ext ? `.${ext}` : ""}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file)
    setUploading(false)
    if (error) {
      toast.error("No se pudo subir la imagen.")
      return
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    onChange(data.publicUrl)
    toast.success("Imagen subida.")
  }

  async function openGallery() {
    setGalleryOpen(true)
    setGalleryLoading(true)
    const { data, error } = await supabase.storage.from(BUCKET).list("", {
      limit: 200,
      sortBy: { column: "created_at", order: "desc" },
    })
    setGalleryLoading(false)
    if (error) {
      toast.error("No se pudo cargar la galería.")
      return
    }
    setGalleryFiles(
      (data ?? [])
        .filter((f) => f.id)
        .map((f) => ({
          name: f.name,
          url: supabase.storage.from(BUCKET).getPublicUrl(f.name).data.publicUrl,
        }))
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageOff className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-1 h-3.5 w-3.5" />
            {uploading ? "Subiendo…" : "Subir"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={openGallery}>
            <Images className="mr-1 h-3.5 w-3.5" />
            Galería
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              <X className="mr-1 h-3.5 w-3.5" />
              Quitar
            </Button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Elegir de la galería</DialogTitle>
          </DialogHeader>
          {galleryLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : galleryFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no subiste ninguna imagen. Usa "Subir" para agregar la primera.
            </p>
          ) : (
            <div className="grid max-h-[60vh] grid-cols-4 gap-3 overflow-y-auto">
              {galleryFiles.map((f) => (
                <button
                  type="button"
                  key={f.name}
                  onClick={() => {
                    onChange(f.url)
                    setGalleryOpen(false)
                  }}
                  className="aspect-square overflow-hidden rounded-md border hover:ring-2 hover:ring-primary"
                >
                  <img src={f.url} alt={f.name} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
