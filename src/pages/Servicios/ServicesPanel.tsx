import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, Pencil, Plus } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { BOOKING_GROUPS, type Service, type ServiceCategory } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import ServiceFormDialog from "@/pages/Servicios/ServiceFormDialog"

export default function ServicesPanel() {
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [group, setGroup] = useState<(typeof BOOKING_GROUPS)[number]>("Principales")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)

  async function load() {
    setLoading(true)
    const [{ data: svcs, error: svcErr }, { data: cats, error: catErr }] = await Promise.all([
      supabase.from("services").select("*").order("sort_order"),
      supabase.from("service_categories").select("*").order("sort_order"),
    ])
    if (svcErr || catErr) {
      toast.error("No se pudieron cargar los servicios.")
      setLoading(false)
      return
    }
    setServices(svcs as Service[])
    setCategories(cats as ServiceCategory[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel("services-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "services" }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const categoryById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  )
  const filtered = useMemo(() => services.filter((s) => s.booking_group === group), [services, group])

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= filtered.length) return
    const a = filtered[index]
    const b = filtered[target]
    const previous = services
    setServices((rows) =>
      rows.map((r) => {
        if (r.id === a.id) return { ...r, sort_order: b.sort_order }
        if (r.id === b.id) return { ...r, sort_order: a.sort_order }
        return r
      }),
    )
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("services").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("services").update({ sort_order: a.sort_order }).eq("id", b.id),
    ])
    if (e1 || e2) {
      setServices(previous)
      toast.error("No se pudo reordenar.")
    }
  }

  async function toggleActive(service: Service) {
    const previous = services
    setServices((rows) => rows.map((s) => (s.id === service.id ? { ...s, active: !s.active } : s)))
    const { error } = await supabase.from("services").update({ active: !service.active }).eq("id", service.id)
    if (error) {
      setServices(previous)
      toast.error("No se pudo actualizar.")
    } else {
      toast.success(service.active ? "Servicio archivado." : "Servicio reactivado.")
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={group} onValueChange={(v) => setGroup(v as typeof group)}>
          <TabsList>
            {BOOKING_GROUPS.map((g) => (
              <TabsTrigger key={g} value={g}>
                {g}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button
          size="sm"
          disabled={!categories.length}
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          <Plus className="size-4" />
          Nuevo servicio
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {loading ? (
          <div className="flex flex-col gap-3 p-5">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">
            No hay servicios en este grupo todavía.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16"></TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Duración</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Adelanto</TableHead>
                  <TableHead>Activo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s, i) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)}>
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={i === filtered.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.id}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {categoryById[s.category_id]?.title ?? s.category_id}
                    </TableCell>
                    <TableCell className="text-sm">{s.duration}</TableCell>
                    <TableCell className="text-sm">S/ {s.price}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.deposit_amount != null ? `S/ ${s.deposit_amount}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Switch checked={s.active} onCheckedChange={() => toggleActive(s)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setEditing(s)
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
          </div>
        )}
      </div>

      <ServiceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        service={editing}
        categories={categories}
        defaultBookingGroup={group}
        nextSortOrder={filtered.length ? Math.max(...filtered.map((s) => s.sort_order)) + 10 : 0}
        onSaved={load}
      />
    </div>
  )
}
