import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { BOOKING_GROUPS, type Service, type ServiceCategory } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

export default function ServiceFormDialog({
  open,
  onOpenChange,
  service,
  categories,
  defaultBookingGroup,
  nextSortOrder,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  service: Service | null
  categories: ServiceCategory[]
  defaultBookingGroup: (typeof BOOKING_GROUPS)[number]
  nextSortOrder: number
  onSaved: () => void
}) {
  const isEdit = !!service
  const [id, setId] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [bookingGroup, setBookingGroup] = useState<(typeof BOOKING_GROUPS)[number]>(defaultBookingGroup)
  const [name, setName] = useState("")
  const [duration, setDuration] = useState("")
  const [price, setPrice] = useState("")
  const [description, setDescription] = useState("")
  const [depositAmount, setDepositAmount] = useState("")
  const [active, setActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setId(service?.id ?? "")
    setCategoryId(service?.category_id ?? categories[0]?.id ?? "")
    setBookingGroup(service?.booking_group ?? defaultBookingGroup)
    setName(service?.name ?? "")
    setDuration(service?.duration ?? "—")
    setPrice(service?.price ?? "")
    setDescription(service?.description ?? "")
    setDepositAmount(service?.deposit_amount != null ? String(service.deposit_amount) : "")
    setActive(service?.active ?? true)
  }, [open, service, categories, defaultBookingGroup])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const payload = {
      category_id: categoryId,
      booking_group: bookingGroup,
      name: name.trim(),
      duration: duration.trim() || "—",
      price: price.trim(),
      description: description.trim(),
      deposit_amount: depositAmount.trim() ? Number(depositAmount) : null,
      active,
    }

    const { error } = isEdit
      ? await supabase.from("services").update(payload).eq("id", service!.id)
      : await supabase
          .from("services")
          .insert({ ...payload, id: slugify(id || name), sort_order: nextSortOrder })

    setSubmitting(false)
    if (error) {
      toast.error(isEdit ? "No se pudo guardar el servicio." : "No se pudo crear el servicio.")
      return
    }
    toast.success(isEdit ? "Servicio actualizado." : "Servicio creado.")
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar servicio" : "Nuevo servicio"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="svc-name">Nombre</Label>
            <Input id="svc-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="svc-id">Id (slug)</Label>
            <Input
              id="svc-id"
              required
              disabled={isEdit}
              value={isEdit ? service!.id : id || slugify(name)}
              onChange={(e) => setId(e.target.value)}
              placeholder="microblading"
            />
            {isEdit && (
              <p className="text-xs text-muted-foreground">
                No se puede cambiar: ya se usa en reservas existentes.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label>Categoría</Label>
              <Select value={categoryId} onValueChange={(v) => setCategoryId(v as string)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Elegir categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.icon} {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Grupo de reserva</Label>
              <Select value={bookingGroup} onValueChange={(v) => setBookingGroup(v as typeof bookingGroup)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BOOKING_GROUPS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="svc-duration">Duración</Label>
              <Input id="svc-duration" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="2h o —" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="svc-price">Precio</Label>
              <Input id="svc-price" required value={price} onChange={(e) => setPrice(e.target.value)} placeholder="250 o 15–40" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="svc-deposit">Adelanto requerido (S/, opcional)</Label>
            <Input
              id="svc-deposit"
              type="number"
              step="0.01"
              min="0"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Sin definir"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="svc-desc">Descripción</Label>
            <Textarea id="svc-desc" required value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="svc-active" checked={active} onCheckedChange={setActive} />
            <Label htmlFor="svc-active">Activo (visible en el sitio)</Label>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting || !categoryId}>
              {submitting ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
