import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { ArrowDown, ArrowUp, ArrowLeft, Pencil, Plus, Trash2, X } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Course, CourseDay, CourseLesson, CourseMaterial, LessonModality } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const MODALITIES: LessonModality[] = ["Video", "Presencial"]

function LessonRow({
  lesson,
  isFirst,
  isLast,
  onMove,
  onSaved,
  onDeleted,
}: {
  lesson: CourseLesson
  isFirst: boolean
  isLast: boolean
  onMove: (direction: -1 | 1) => void
  onSaved: () => void
  onDeleted: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(lesson.title)
  const [modality, setModality] = useState<LessonModality>(lesson.modality)
  const [duration, setDuration] = useState(lesson.duration)
  const [videoUrl, setVideoUrl] = useState(lesson.video_url ?? "")
  const [submitting, setSubmitting] = useState(false)

  async function save() {
    setSubmitting(true)
    const { error } = await supabase
      .from("course_lessons")
      .update({
        title: title.trim(),
        modality,
        duration: duration.trim(),
        video_url: modality === "Video" ? videoUrl.trim() || null : null,
      })
      .eq("id", lesson.id)
    setSubmitting(false)
    if (error) {
      toast.error("No se pudo guardar la lección.")
      return
    }
    toast.success("Lección actualizada.")
    setEditing(false)
    onSaved()
  }

  async function remove() {
    const { error } = await supabase.from("course_lessons").delete().eq("id", lesson.id)
    if (error) {
      toast.error("No se pudo eliminar la lección.")
      return
    }
    onDeleted()
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3">
        <div className="grid grid-cols-2 gap-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título de la lección" />
          <Select value={modality} onValueChange={(v) => setModality(v as LessonModality)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODALITIES.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="18 min" />
          {modality === "Video" && (
            <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://…" />
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={submitting}>
            {submitting ? "Guardando…" : "Guardar"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            <X className="size-4" />
            Cancelar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" disabled={isFirst} onClick={() => onMove(-1)}>
          <ArrowUp className="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon-sm" disabled={isLast} onClick={() => onMove(1)}>
          <ArrowDown className="size-3.5" />
        </Button>
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium">{lesson.title}</div>
        <div className="text-xs text-muted-foreground">
          {lesson.modality} · {lesson.duration || "—"}
          {lesson.video_url ? ` · ${lesson.video_url}` : ""}
        </div>
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="icon-sm" onClick={() => setEditing(true)}>
          <Pencil className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={remove}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  )
}

function AddLessonForm({ dayId, nextSortOrder, onAdded }: { dayId: string; nextSortOrder: number; onAdded: () => void }) {
  const [title, setTitle] = useState("")
  const [modality, setModality] = useState<LessonModality>("Video")
  const [duration, setDuration] = useState("")
  const [videoUrl, setVideoUrl] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const { error } = await supabase.from("course_lessons").insert({
      day_id: dayId,
      title: title.trim(),
      modality,
      duration: duration.trim(),
      video_url: modality === "Video" ? videoUrl.trim() || null : null,
      sort_order: nextSortOrder,
    })
    setSubmitting(false)
    if (error) {
      toast.error("No se pudo agregar la lección.")
      return
    }
    setTitle("")
    setDuration("")
    setVideoUrl("")
    onAdded()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3">
      <div className="grid grid-cols-2 gap-2">
        <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título de la lección" />
        <Select value={modality} onValueChange={(v) => setModality(v as LessonModality)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODALITIES.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input required value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="18 min" />
        {modality === "Video" && (
          <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://…" />
        )}
      </div>
      <Button type="submit" size="sm" disabled={submitting} className="self-start">
        <Plus className="size-4" />
        Agregar lección
      </Button>
    </form>
  )
}

function DayCard({
  day,
  lessons,
  isFirst,
  isLast,
  onMove,
  onReload,
}: {
  day: CourseDay
  lessons: CourseLesson[]
  isFirst: boolean
  isLast: boolean
  onMove: (direction: -1 | 1) => void
  onReload: () => void
}) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(day.title)
  const [submitting, setSubmitting] = useState(false)

  async function saveTitle() {
    setSubmitting(true)
    const { error } = await supabase.from("course_days").update({ title: title.trim() }).eq("id", day.id)
    setSubmitting(false)
    if (error) {
      toast.error("No se pudo guardar el día.")
      return
    }
    setEditingTitle(false)
    onReload()
  }

  async function moveLesson(lesson: CourseLesson, direction: -1 | 1) {
    const sorted = [...lessons].sort((a, b) => a.sort_order - b.sort_order)
    const index = sorted.findIndex((l) => l.id === lesson.id)
    const target = index + direction
    if (target < 0 || target >= sorted.length) return
    const a = sorted[index]
    const b = sorted[target]
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("course_lessons").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("course_lessons").update({ sort_order: a.sort_order }).eq("id", b.id),
    ])
    if (e1 || e2) toast.error("No se pudo reordenar.")
    onReload()
  }

  async function deleteDay() {
    const { error } = await supabase.from("course_days").delete().eq("id", day.id)
    if (error) {
      toast.error("No se pudo eliminar el día.")
      return
    }
    onReload()
  }

  const sortedLessons = [...lessons].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" disabled={isFirst} onClick={() => onMove(-1)}>
              <ArrowUp className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" disabled={isLast} onClick={() => onMove(1)}>
              <ArrowDown className="size-4" />
            </Button>
          </div>
          {editingTitle ? (
            <div className="flex flex-1 items-center gap-2">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              <Button size="sm" onClick={saveTitle} disabled={submitting}>
                Guardar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingTitle(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="flex-1 font-medium">{day.title}</div>
          )}
          {!editingTitle && (
            <div className="flex gap-1">
              <Button variant="ghost" size="icon-sm" onClick={() => setEditingTitle(true)}>
                <Pencil className="size-4" />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={deleteDay}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 pl-2">
          {sortedLessons.map((lesson, i) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              isFirst={i === 0}
              isLast={i === sortedLessons.length - 1}
              onMove={(direction) => moveLesson(lesson, direction)}
              onSaved={onReload}
              onDeleted={onReload}
            />
          ))}
          <AddLessonForm
            dayId={day.id}
            nextSortOrder={sortedLessons.length ? Math.max(...sortedLessons.map((l) => l.sort_order)) + 10 : 0}
            onAdded={onReload}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function MaterialRow({ material, onSaved, onDeleted }: { material: CourseMaterial; onSaved: () => void; onDeleted: () => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(material.name)
  const [meta, setMeta] = useState(material.meta)
  const [fileUrl, setFileUrl] = useState(material.file_url)
  const [submitting, setSubmitting] = useState(false)

  async function save() {
    setSubmitting(true)
    const { error } = await supabase
      .from("course_materials")
      .update({ name: name.trim(), meta: meta.trim(), file_url: fileUrl.trim() })
      .eq("id", material.id)
    setSubmitting(false)
    if (error) {
      toast.error("No se pudo guardar el material.")
      return
    }
    setEditing(false)
    onSaved()
  }

  async function remove() {
    const { error } = await supabase.from("course_materials").delete().eq("id", material.id)
    if (error) {
      toast.error("No se pudo eliminar el material.")
      return
    }
    onDeleted()
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Manual de práctica (PDF)" />
        <Input value={meta} onChange={(e) => setMeta(e.target.value)} placeholder="Microblading básico · 24 páginas" />
        <Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://…" />
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={submitting}>
            {submitting ? "Guardando…" : "Guardar"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <div className="flex-1">
        <div className="text-sm font-medium">{material.name}</div>
        <div className="text-xs text-muted-foreground">{material.meta}</div>
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="icon-sm" onClick={() => setEditing(true)}>
          <Pencil className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={remove}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  )
}

export default function CourseSyllabusPanel({ course, onBack }: { course: Course; onBack: () => void }) {
  const [days, setDays] = useState<CourseDay[]>([])
  const [lessons, setLessons] = useState<CourseLesson[]>([])
  const [materials, setMaterials] = useState<CourseMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [newDayTitle, setNewDayTitle] = useState("")
  const [newMaterial, setNewMaterial] = useState({ name: "", meta: "", file_url: "" })

  async function load() {
    setLoading(true)
    const [{ data: d, error: dErr }, { data: m, error: mErr }] = await Promise.all([
      supabase.from("course_days").select("*").eq("course_id", course.id).order("sort_order"),
      supabase.from("course_materials").select("*").eq("course_id", course.id).order("sort_order"),
    ])
    if (dErr || mErr) {
      toast.error("No se pudo cargar el temario.")
      setLoading(false)
      return
    }
    const dayIds = (d as CourseDay[]).map((row) => row.id)
    const { data: l, error: lErr } = dayIds.length
      ? await supabase.from("course_lessons").select("*").in("day_id", dayIds).order("sort_order")
      : { data: [] as CourseLesson[], error: null }
    if (lErr) {
      toast.error("No se pudieron cargar las lecciones.")
    }
    setDays(d as CourseDay[])
    setMaterials(m as CourseMaterial[])
    setLessons((l ?? []) as CourseLesson[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id])

  async function addDay(e: FormEvent) {
    e.preventDefault()
    if (!newDayTitle.trim()) return
    const nextSortOrder = days.length ? Math.max(...days.map((d) => d.sort_order)) + 10 : 0
    const { error } = await supabase
      .from("course_days")
      .insert({ course_id: course.id, title: newDayTitle.trim(), sort_order: nextSortOrder })
    if (error) {
      toast.error("No se pudo agregar el día.")
      return
    }
    setNewDayTitle("")
    load()
  }

  async function moveDay(day: CourseDay, direction: -1 | 1) {
    const sorted = [...days].sort((a, b) => a.sort_order - b.sort_order)
    const index = sorted.findIndex((d) => d.id === day.id)
    const target = index + direction
    if (target < 0 || target >= sorted.length) return
    const a = sorted[index]
    const b = sorted[target]
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("course_days").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("course_days").update({ sort_order: a.sort_order }).eq("id", b.id),
    ])
    if (e1 || e2) toast.error("No se pudo reordenar.")
    load()
  }

  async function addMaterial(e: FormEvent) {
    e.preventDefault()
    if (!newMaterial.name.trim() || !newMaterial.file_url.trim()) return
    const nextSortOrder = materials.length ? Math.max(...materials.map((m) => m.sort_order)) + 10 : 0
    const { error } = await supabase.from("course_materials").insert({
      course_id: course.id,
      name: newMaterial.name.trim(),
      meta: newMaterial.meta.trim(),
      file_url: newMaterial.file_url.trim(),
      sort_order: nextSortOrder,
    })
    if (error) {
      toast.error("No se pudo agregar el material.")
      return
    }
    setNewMaterial({ name: "", meta: "", file_url: "" })
    load()
  }

  const sortedDays = [...days].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-2 -ml-2">
          <ArrowLeft className="size-4" />
          Volver a cursos
        </Button>
        <h2 className="text-lg font-semibold">
          {course.icon} {course.title}
        </h2>
        <p className="text-sm text-muted-foreground">Temario y materiales de este curso.</p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Días y lecciones
            </h3>
            <div className="flex flex-col gap-3">
              {sortedDays.map((day, i) => (
                <DayCard
                  key={day.id}
                  day={day}
                  lessons={lessons.filter((l) => l.day_id === day.id)}
                  isFirst={i === 0}
                  isLast={i === sortedDays.length - 1}
                  onMove={(direction) => moveDay(day, direction)}
                  onReload={load}
                />
              ))}
              <form onSubmit={addDay} className="flex gap-2">
                <Input
                  value={newDayTitle}
                  onChange={(e) => setNewDayTitle(e.target.value)}
                  placeholder="Día 4 · Evaluación final"
                />
                <Button type="submit" size="sm">
                  <Plus className="size-4" />
                  Agregar día
                </Button>
              </form>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Materiales descargables
            </h3>
            <div className="flex flex-col gap-2">
              {materials
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((m) => (
                  <MaterialRow key={m.id} material={m} onSaved={load} onDeleted={load} />
                ))}
              <form onSubmit={addMaterial} className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">Nombre</Label>
                    <Input
                      value={newMaterial.name}
                      onChange={(e) => setNewMaterial((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Manual de práctica (PDF)"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">Detalle</Label>
                    <Input
                      value={newMaterial.meta}
                      onChange={(e) => setNewMaterial((f) => ({ ...f, meta: e.target.value }))}
                      placeholder="24 páginas"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Archivo (URL)</Label>
                  <Input
                    value={newMaterial.file_url}
                    onChange={(e) => setNewMaterial((f) => ({ ...f, file_url: e.target.value }))}
                    placeholder="https://…"
                  />
                </div>
                <Button type="submit" size="sm" className="self-start">
                  <Plus className="size-4" />
                  Agregar material
                </Button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
