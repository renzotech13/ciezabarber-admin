import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import type { Course } from "@/lib/types"
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

export default function CourseFormDialog({
  open,
  onOpenChange,
  course,
  nextSortOrder,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  course: Course | null
  nextSortOrder: number
  onSaved: () => void
}) {
  const isEdit = !!course
  const [id, setId] = useState("")
  const [icon, setIcon] = useState("")
  const [title, setTitle] = useState("")
  const [meta, setMeta] = useState("")
  const [description, setDescription] = useState("")
  const [images, setImages] = useState(["", "", ""])
  const [price, setPrice] = useState("")
  const [active, setActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setId(course?.id ?? "")
    setIcon(course?.icon ?? "")
    setTitle(course?.title ?? "")
    setMeta(course?.meta ?? "")
    setDescription(course?.description ?? "")
    const imgs = course?.images ?? []
    setImages([imgs[0] ?? "", imgs[1] ?? "", imgs[2] ?? ""])
    setPrice(course?.price != null ? String(course.price) : "")
    setActive(course?.active ?? true)
  }, [open, course])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const payload = {
      icon: icon.trim(),
      title: title.trim(),
      meta: meta.trim(),
      description: description.trim(),
      images: images.map((i) => i.trim()).filter(Boolean),
      price: price.trim() ? Number(price) : null,
      active,
    }

    const { error } = isEdit
      ? await supabase.from("courses").update(payload).eq("id", course!.id)
      : await supabase
          .from("courses")
          .insert({ ...payload, id: slugify(id || title), sort_order: nextSortOrder })

    setSubmitting(false)
    if (error) {
      toast.error(isEdit ? "No se pudo guardar el curso." : "No se pudo crear el curso.")
      return
    }
    toast.success(isEdit ? "Curso actualizado." : "Curso creado.")
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar curso" : "Nuevo curso"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="course-icon">Ícono</Label>
              <Input id="course-icon" required value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="✎" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="course-id">Id (slug)</Label>
              <Input
                id="course-id"
                required
                disabled={isEdit}
                value={isEdit ? course!.id : id || slugify(title)}
                onChange={(e) => setId(e.target.value)}
                placeholder="microblading-basico"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="course-title">Título</Label>
            <Input id="course-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="course-meta">Línea meta (duración · modalidad · precio)</Label>
            <Input
              id="course-meta"
              required
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
              placeholder="3 días · Mixto (presencial + grabado) · S/ 1200"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="course-desc">Descripción</Label>
            <Textarea id="course-desc" required value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="course-price">Precio (S/, opcional)</Label>
            <Input
              id="course-price"
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Sin definir"
            />
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
            <Switch id="course-active" checked={active} onCheckedChange={setActive} />
            <Label htmlFor="course-active">Activo (visible en el sitio)</Label>
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
