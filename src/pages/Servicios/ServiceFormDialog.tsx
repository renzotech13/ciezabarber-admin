import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { BOOKING_GROUPS, type Service, type ServiceCategory } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ModalFicha } from "@/components/ModalFicha"

/**
 * "45 min", "1 h 20 min" — la etiqueta que ve el cliente en la carta, armada
 * a partir de los minutos reales para que las dos nunca se contradigan.
 */
function etiquetaDuracion(minutos: number): string {
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  if (horas === 0) return `${resto} min`
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`
}

/** Lee los minutos de una duración escrita a mano ("1 h 20 min", "45 min", "1"). */
function minutosDesdeTexto(texto: string): number | null {
  const t = texto.toLowerCase()
  const horas = /(\d+)\s*h/.exec(t)
  const mins = /(\d+)\s*m/.exec(t)
  if (horas || mins) return Number(horas?.[1] ?? 0) * 60 + Number(mins?.[1] ?? 0)
  const solo = /^\s*(\d+)\s*$/.exec(t)
  // Un número pelado en la carta vieja significaba horas ("1" = 1 h).
  return solo ? Number(solo[1]) * 60 : null
}

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
  const [duracionMin, setDuracionMin] = useState("")
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
    // Los servicios viejos pueden no tener los minutos cargados: se deducen
    // de la etiqueta para no perderlos al reeditar.
    setDuracionMin(
      String(service?.duration_minutes ?? (service?.duration ? (minutosDesdeTexto(service.duration) ?? "") : "")),
    )
    setPrice(service?.price ?? "")
    setDescription(service?.description ?? "")
    setDepositAmount(service?.deposit_amount != null ? String(service.deposit_amount) : "")
    setActive(service?.active ?? true)
  }, [open, service, categories, defaultBookingGroup])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const minutos = Number(duracionMin)
    if (!Number.isInteger(minutos) || minutos <= 0) {
      setSubmitting(false)
      // Sin minutos el bot no puede calcular a qué hora termina: el servicio
      // queda invisible para la agenda, la reserva web y el registro manual.
      toast.error("Pon la duración en minutos: sin eso no se puede reservar ni registrar.")
      return
    }

    const payload = {
      category_id: categoryId,
      booking_group: bookingGroup,
      name: name.trim(),
      duration: etiquetaDuracion(minutos),
      duration_minutes: minutos,
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
    <ModalFicha
      open={open}
      onOpenChange={onOpenChange}
      mini={isEdit ? service!.name : "Carta de servicios"}
      titulo={isEdit ? "Editar servicio" : "Nuevo servicio"}
      ancho="sm:max-w-lg"
      pie={
        <button
          type="submit"
          form="svc-form"
          disabled={submitting || !categoryId}
          className="chip23 on disabled:opacity-40"
        >
          {submitting ? "Guardando…" : "Guardar"}
        </button>
      }
    >
      <form id="svc-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="svc-name" className="brand-serif">Nombre</Label>
          <Input id="svc-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Corte clásico" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="svc-id" className="brand-serif">Id (slug)</Label>
          <Input
            id="svc-id"
            required
            disabled={isEdit}
            value={isEdit ? service!.id : id || slugify(name)}
            onChange={(e) => setId(e.target.value)}
            placeholder="corte-basico"
          />
          {isEdit && (
            <p className="brand-serif text-[12px] text-muted-foreground">
              No se puede cambiar: ya se usa en reservas existentes.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="brand-serif">Categoría</Label>
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
          <div className="flex flex-col gap-1.5">
            <Label className="brand-serif">Grupo de reserva</Label>
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

        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="svc-duration" className="brand-serif">Duración (min)</Label>
            <Input
              id="svc-duration"
              type="number"
              min="5"
              step="5"
              required
              value={duracionMin}
              onChange={(e) => setDuracionMin(e.target.value)}
              placeholder="45"
              className="tnum"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="svc-price" className="brand-serif">Precio (S/)</Label>
            <Input id="svc-price" required value={price} onChange={(e) => setPrice(e.target.value)} placeholder="40" className="tnum" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="svc-deposit" className="brand-serif">Pago fijo (S/)</Label>
            <Input
              id="svc-deposit"
              type="number"
              step="0.01"
              min="0"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Precio"
              className="tnum"
            />
          </div>
        </div>
        <p className="brand-serif -mt-2 text-[12px] text-muted-foreground">
          {Number(duracionMin) > 0 && `En la carta se muestra como “${etiquetaDuracion(Number(duracionMin))}”. `}
          Se cobra el servicio completo por adelantado. Llena “pago fijo” solo si este servicio se
          cobra distinto al precio de la carta.
        </p>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="svc-desc" className="brand-serif">Descripción (opcional)</Label>
          <Textarea
            id="svc-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Máquina y tijera, lavado y peinado."
            rows={2}
          />
        </div>

        <label className="flex items-center gap-2.5 border border-border px-3 py-2.5">
          <Switch id="svc-active" checked={active} onCheckedChange={setActive} />
          <span className="brand-serif text-[13px]">Activo (visible en el sitio)</span>
        </label>
      </form>
    </ModalFicha>
  )
}
