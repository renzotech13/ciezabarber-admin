import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import type { ServiceCategory } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { ImagePicker } from "@/components/ImagePicker"
import { ModalFicha } from "@/components/ModalFicha"

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
    <ModalFicha
      open={open}
      onOpenChange={onOpenChange}
      mini={isEdit ? category!.title : "Carta de servicios"}
      titulo={isEdit ? "Editar categoría" : "Nueva categoría"}
      ancho="sm:max-w-lg"
      pie={
        <button type="submit" form="cat-form" disabled={submitting} className="chip23 on disabled:opacity-40">
          {submitting ? "Guardando…" : "Guardar"}
        </button>
      }
    >
      <form id="cat-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-[80px_1fr] gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cat-icon" className="brand-serif">Ícono</Label>
            <Input id="cat-icon" required value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="✂" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cat-id" className="brand-serif">Id (slug)</Label>
            <Input
              id="cat-id"
              required
              disabled={isEdit}
              value={isEdit ? category!.id : id || slugify(title)}
              onChange={(e) => setId(e.target.value)}
              placeholder="cortes"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cat-title" className="brand-serif">Título</Label>
          <Input id="cat-title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cortes" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cat-desc" className="brand-serif">Descripción</Label>
          <Textarea
            id="cat-desc"
            required
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Cortes clásicos y fades, con acabado a navaja."
          />
        </div>

        <div className="flex flex-col gap-3">
          <Label className="brand-serif">Imágenes (hasta 3)</Label>
          {images.map((img, i) => (
            <ImagePicker
              key={i}
              label={`Imagen ${i + 1}`}
              value={img || null}
              onChange={(url) => setImages((prev) => prev.map((v, idx) => (idx === i ? url ?? "" : v)))}
            />
          ))}
        </div>

        <label className="flex items-center gap-2.5 border border-border px-3 py-2.5">
          <Switch id="cat-active" checked={active} onCheckedChange={setActive} />
          <span className="brand-serif text-[13px]">Activa (visible en el sitio)</span>
        </label>
      </form>
    </ModalFicha>
  )
}
