import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, ListTree, Pencil, Plus } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Course } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import CourseFormDialog from "@/pages/Elearning/CourseFormDialog"

export default function CoursesPanel({ onManageSyllabus }: { onManageSyllabus: (course: Course) => void }) {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Course | null>(null)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from("courses").select("*").order("sort_order")
    if (error) {
      toast.error("No se pudieron cargar los cursos.")
    } else {
      setCourses(data as Course[])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel("courses-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "courses" }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= courses.length) return
    const a = courses[index]
    const b = courses[target]
    const previous = courses
    const reordered = [...courses]
    reordered[index] = { ...b, sort_order: a.sort_order }
    reordered[target] = { ...a, sort_order: b.sort_order }
    reordered.sort((x, y) => x.sort_order - y.sort_order)
    setCourses(reordered)

    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("courses").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("courses").update({ sort_order: a.sort_order }).eq("id", b.id),
    ])
    if (e1 || e2) {
      setCourses(previous)
      toast.error("No se pudo reordenar.")
    }
  }

  async function toggleActive(course: Course) {
    const previous = courses
    setCourses((rows) => rows.map((c) => (c.id === course.id ? { ...c, active: !c.active } : c)))
    const { error } = await supabase.from("courses").update({ active: !course.active }).eq("id", course.id)
    if (error) {
      setCourses(previous)
      toast.error("No se pudo actualizar.")
    } else {
      toast.success(course.active ? "Curso archivado." : "Curso reactivado.")
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
          Nuevo curso
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {loading ? (
          <div className="flex flex-col gap-3 p-5">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : courses.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">
            No hay cursos todavía.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16"></TableHead>
                  <TableHead>Curso</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Activo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((c, i) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)}>
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={i === courses.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {c.icon} {c.title}
                      </div>
                      <div className="text-xs text-muted-foreground">{c.id}</div>
                    </TableCell>
                    <TableCell className="max-w-64 text-sm text-muted-foreground">{c.meta}</TableCell>
                    <TableCell className="text-sm">{c.price != null ? `S/ ${c.price}` : "—"}</TableCell>
                    <TableCell>
                      <Switch checked={c.active} onCheckedChange={() => toggleActive(c)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => onManageSyllabus(c)}>
                          <ListTree className="size-4" />
                          Temario
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
          </div>
        )}
      </div>

      <CourseFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        course={editing}
        nextSortOrder={courses.length ? Math.max(...courses.map((c) => c.sort_order)) + 10 : 0}
        onSaved={load}
      />
    </div>
  )
}
