import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, Pencil, Plus } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Service, ServiceCategory } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import CategoryFormDialog from "@/pages/Servicios/CategoryFormDialog"

export default function CategoriesPanel() {
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [serviceCounts, setServiceCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ServiceCategory | null>(null)

  async function load() {
    setLoading(true)
    const [{ data: cats, error: catErr }, { data: svcs, error: svcErr }] = await Promise.all([
      supabase.from("service_categories").select("*").order("sort_order"),
      supabase.from("services").select("category_id"),
    ])
    if (catErr || svcErr) {
      toast.error("No se pudieron cargar las categorías.")
      setLoading(false)
      return
    }
    setCategories(cats as ServiceCategory[])
    const counts: Record<string, number> = {}
    for (const s of (svcs as Pick<Service, "category_id">[]) ?? []) {
      counts[s.category_id] = (counts[s.category_id] ?? 0) + 1
    }
    setServiceCounts(counts)
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel("service-categories-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "service_categories" }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= categories.length) return
    const a = categories[index]
    const b = categories[target]
    const previous = categories
    const reordered = [...categories]
    reordered[index] = { ...b, sort_order: a.sort_order }
    reordered[target] = { ...a, sort_order: b.sort_order }
    reordered.sort((x, y) => x.sort_order - y.sort_order)
    setCategories(reordered)

    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("service_categories").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("service_categories").update({ sort_order: a.sort_order }).eq("id", b.id),
    ])
    if (e1 || e2) {
      setCategories(previous)
      toast.error("No se pudo reordenar.")
    }
  }

  async function toggleActive(category: ServiceCategory) {
    const previous = categories
    setCategories((rows) => rows.map((c) => (c.id === category.id ? { ...c, active: !c.active } : c)))
    const { error } = await supabase
      .from("service_categories")
      .update({ active: !category.active })
      .eq("id", category.id)
    if (error) {
      setCategories(previous)
      toast.error("No se pudo actualizar.")
    } else {
      toast.success(category.active ? "Categoría archivada." : "Categoría reactivada.")
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button
          size="sm"
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          <Plus className="size-4" />
          Nueva categoría
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {loading ? (
          <div className="flex flex-col gap-3 p-5">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead># servicios</TableHead>
                <TableHead>Activa</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c, i) => (
                <TableRow key={c.id}>
                  <TableCell className="text-lg">{c.icon}</TableCell>
                  <TableCell>
                    <div className="font-medium">{c.title}</div>
                    <div className="text-xs text-muted-foreground">{c.id}</div>
                  </TableCell>
                  <TableCell>{serviceCounts[c.id] ?? 0}</TableCell>
                  <TableCell>
                    <Switch checked={c.active} onCheckedChange={() => toggleActive(c)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)}>
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={i === categories.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setEditing(c)
                          setDialogOpen(true)
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CategoryFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={editing}
        nextSortOrder={categories.length ? Math.max(...categories.map((c) => c.sort_order)) + 10 : 0}
        onSaved={load}
      />
    </div>
  )
}
