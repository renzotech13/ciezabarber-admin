import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import type { ServiceCategory } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { ImagePicker } from "@/components/ImagePicker"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export default function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  nextSortOrder,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: ServiceCategory | null
  nextSortOrder: number
  onSaved: () => void
}) {
  const isEdit = !!category
  const [id, setId] = useState("")
  const [icon, setIcon] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [images, setImages] = useState(["", "", ""])
  const [active, setActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setId(category?.id ?? "")
    setIcon(category?.icon ?? "")
    setTitle(category?.title ?? "")
    setDescription(category?.description ?? "")
    const imgs = category?.images ?? []
    setImages([imgs[0] ?? "", imgs[1] ?? "", imgs[2] ?? ""])
    setActive(category?.active ?? true)
  }, [open, category])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const payload = {
      icon: icon.trim(),
      title: title.trim(),
      description: description.trim(),
      images: images.map((i) => i.trim()).filter(Boolean),
      active,
    }

    const { error } = isEdit
      ? await supabase.from("service_categories").update(payload).eq("id", category!.id)
      : await supabase
          .from("service_categories")
          .insert({ ...payload, id: slugify(id || title), sort_order: nextSortOrder })

    setSubmitting(false)
    if (error) {
      toast.error(isEdit ? "No se pudo guardar la categoría." : "No se pudo crear la categoría.")
      return
    }
    toast.success(isEdit ? "Categoría actualizada." : "Categoría creada.")
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cat-icon">Ícono</Label>
              <Input id="cat-icon" required value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="✎" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cat-id">Id (slug)</Label>
              <Input
                id="cat-id"
                required
                disabled={isEdit}
                value={isEdit ? category!.id : id || slugify(title)}
                onChange={(e) => setId(e.target.value)}
                placeholder="cejas"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cat-title">Título</Label>
            <Input id="cat-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cat-desc">Descripción</Label>
            <Textarea id="cat-desc" required value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex flex-col gap-4">
            <Label>Imágenes (hasta 3)</Label>
            {images.map((img, i) => (
              <ImagePicker
                key={i}
                label={`Imagen ${i + 1}`}
                value={img || null}
                onChange={(url) => setImages((prev) => prev.map((v, idx) => (idx === i ? url ?? "" : v)))}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Switch id="cat-active" checked={active} onCheckedChange={setActive} />
            <Label htmlFor="cat-active">Activa (visible en el sitio)</Label>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
