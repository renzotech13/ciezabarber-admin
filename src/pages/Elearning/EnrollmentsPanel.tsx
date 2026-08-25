import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { ChevronDown } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { ENROLLMENT_STATUS_LABEL, type Enrollment, type EnrollmentStatus } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type EnrollmentRow = Enrollment & {
  profiles: { full_name: string | null; phone: string | null } | null
  courses: { title: string } | null
}

const STATUS_ORDER: EnrollmentStatus[] = ["pending", "active", "completed", "cancelled"]
const FILTERS: { key: "all" | EnrollmentStatus; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "pending", label: "Pendientes" },
  { key: "active", label: "Activas" },
  { key: "completed", label: "Completadas" },
  { key: "cancelled", label: "Canceladas" },
]

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-PE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export default function EnrollmentsPanel() {
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | EnrollmentStatus>("all")

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from("enrollments")
        .select("*, profiles(full_name, phone), courses(title)")
        .order("requested_at", { ascending: false })
      if (!active) return
      if (error) {
        toast.error("No se pudieron cargar las inscripciones.")
      } else {
        setEnrollments(data as unknown as EnrollmentRow[])
      }
      setLoading(false)
    }
    load()

    const channel = supabase
      .channel("enrollments-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "enrollments" }, () => load())
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [])

  async function updateStatus(id: string, status: EnrollmentStatus) {
    const previous = enrollments
    setEnrollments((rows) =>
      rows.map((e) => (e.id === id ? { ...e, status, decided_at: new Date().toISOString() } : e)),
    )
    const { error } = await supabase
      .from("enrollments")
      .update({ status, decided_at: new Date().toISOString() })
      .eq("id", id)
    if (error) {
      setEnrollments(previous)
      toast.error("No se pudo actualizar el estado.")
    } else {
      toast.success(`Inscripción marcada como ${ENROLLMENT_STATUS_LABEL[status].toLowerCase()}.`)
    }
  }

  const filtered = useMemo(
    () => (filter === "all" ? enrollments : enrollments.filter((e) => e.status === filter)),
    [enrollments, filter],
  )

  const pendingCount = enrollments.filter((e) => e.status === "pending").length

  return (
    <div>
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          {loading
            ? "Cargando…"
            : pendingCount > 0
              ? `${pendingCount} inscripción${pendingCount === 1 ? "" : "es"} pendiente${pendingCount === 1 ? "" : "s"} de aprobar.`
              : "Sin inscripciones pendientes."}
        </p>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mb-4">
        <TabsList>
          {FILTERS.map((f) => (
            <TabsTrigger key={f.key} value={f.key}>
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {loading ? (
          <div className="flex flex-col gap-3 p-5">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">
            No hay inscripciones en esta categoría todavía.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alumna</TableHead>
                  <TableHead>Curso</TableHead>
                  <TableHead>Solicitada</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="font-medium">{e.profiles?.full_name ?? "Sin nombre"}</div>
                      {e.profiles?.phone && (
                        <a
                          href={`https://wa.me/51${e.profiles.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-muted-foreground hover:text-primary"
                        >
                          {e.profiles.phone}
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{e.courses?.title ?? e.course_id}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(e.requested_at)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{ENROLLMENT_STATUS_LABEL[e.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent">
                          Cambiar estado
                          <ChevronDown className="size-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {STATUS_ORDER.map((s) => (
                            <DropdownMenuItem
                              key={s}
                              disabled={s === e.status}
                              onClick={() => updateStatus(e.id, s)}
                            >
                              {ENROLLMENT_STATUS_LABEL[s]}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
