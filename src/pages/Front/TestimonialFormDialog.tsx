import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import type { Testimonial } from "@/lib/types"
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

export default function TestimonialFormDialog({
  open,
  onOpenChange,
  testimonial,
  nextSortOrder,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  testimonial: Testimonial | null
  nextSortOrder: number
  onSaved: () => void
}) {
  const isEdit = !!testimonial
  const [name, setName] = useState("")
  const [service, setService] = useState("")
  const [quote, setQuote] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [active, setActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(testimonial?.name ?? "")
    setService(testimonial?.service ?? "")
    setQuote(testimonial?.quote ?? "")
    setAvatarUrl(testimonial?.avatar_url ?? "")
    setActive(testimonial?.active ?? true)
  }, [open, testimonial])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const payload = {
      name: name.trim(),
      service: service.trim(),
      quote: quote.trim(),
      avatar_url: avatarUrl.trim() || null,
      active,
    }

    const { error } = isEdit
      ? await supabase.from("testimonials").update(payload).eq("id", testimonial!.id)
      : await supabase.from("testimonials").insert({ ...payload, sort_order: nextSortOrder })

    setSubmitting(false)
    if (error) {
      toast.error(isEdit ? "No se pudo guardar el testimonio." : "No se pudo crear el testimonio.")
      return
    }
    toast.success(isEdit ? "Testimonio actualizado." : "Testimonio creado.")
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar testimonio" : "Nuevo testimonio"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="t-name">Nombre</Label>
            <Input id="t-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="María F." />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="t-service">Servicio o curso</Label>
            <Input id="t-service" required value={service} onChange={(e) => setService(e.target.value)} placeholder="Microblading" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="t-quote">Testimonio</Label>
            <Textarea id="t-quote" required value={quote} onChange={(e) => setQuote(e.target.value)} />
          </div>
          <ImagePicker
            label="Foto (opcional)"
            value={avatarUrl || null}
            onChange={(url) => setAvatarUrl(url ?? "")}
          />
          <div className="flex items-center gap-2">
            <Switch id="t-active" checked={active} onCheckedChange={setActive} />
            <Label htmlFor="t-active">Activo (visible en el sitio)</Label>
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
