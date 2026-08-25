import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, Pencil, Plus } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Testimonial } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import TestimonialFormDialog from "@/pages/Front/TestimonialFormDialog"

export default function TestimonialsPanel() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Testimonial | null>(null)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from("testimonials").select("*").order("sort_order")
    if (error) {
      toast.error("No se pudieron cargar los testimonios.")
    } else {
      setTestimonials(data as Testimonial[])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel("testimonials-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "testimonials" }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= testimonials.length) return
    const a = testimonials[index]
    const b = testimonials[target]
    const previous = testimonials
    const reordered = [...testimonials]
    reordered[index] = { ...b, sort_order: a.sort_order }
    reordered[target] = { ...a, sort_order: b.sort_order }
    reordered.sort((x, y) => x.sort_order - y.sort_order)
    setTestimonials(reordered)

    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("testimonials").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("testimonials").update({ sort_order: a.sort_order }).eq("id", b.id),
    ])
    if (e1 || e2) {
      setTestimonials(previous)
      toast.error("No se pudo reordenar.")
    }
  }

  async function toggleActive(testimonial: Testimonial) {
    const previous = testimonials
    setTestimonials((rows) =>
      rows.map((t) => (t.id === testimonial.id ? { ...t, active: !t.active } : t)),
    )
    const { error } = await supabase
      .from("testimonials")
      .update({ active: !testimonial.active })
      .eq("id", testimonial.id)
    if (error) {
      setTestimonials(previous)
      toast.error("No se pudo actualizar.")
    } else {
      toast.success(testimonial.active ? "Testimonio archivado." : "Testimonio reactivado.")
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
        <Button
          size="sm"
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          <Plus className="size-4" />
          Nuevo testimonio
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {loading ? (
          <div className="flex flex-col gap-3 p-5">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : testimonials.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">
            No hay testimonios todavía.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16"></TableHead>
                <TableHead>Testimonio</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {testimonials.map((t, i) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)}>
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={i === testimonials.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{t.name}</div>
                    <div className="max-w-80 truncate text-xs text-muted-foreground">{t.quote}</div>
                  </TableCell>
                  <TableCell className="text-sm">{t.service}</TableCell>
                  <TableCell>
                    <Switch checked={t.active} onCheckedChange={() => toggleActive(t)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setEditing(t)
                        setDialogOpen(true)
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <TestimonialFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        testimonial={editing}
        nextSortOrder={testimonials.length ? Math.max(...testimonials.map((t) => t.sort_order)) + 10 : 0}
        onSaved={load}
      />
    </div>
  )
}
