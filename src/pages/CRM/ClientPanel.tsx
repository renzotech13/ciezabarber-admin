import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Bell, ImageIcon, Plus, X } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useServiceNames } from "@/lib/services"
import {
  CITA_ESTADO_LABEL,
  COMPROBANTE_ESTADO_LABEL,
  ETIQUETA_CLASSES,
  ETIQUETA_COLORS,
  type Cita,
  type ConversacionResumen,
  type Etiqueta,
  type EtiquetaColor,
  type Notificacion,
} from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

function formatearCita(iso: string) {
  return new Date(iso).toLocaleString("es-PE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Color estable por nombre: la misma etiqueta se ve igual siempre. */
function colorPorNombre(nombre: string): EtiquetaColor {
  let hash = 0
  for (const char of nombre) hash = (hash + char.charCodeAt(0)) % 997
  return ETIQUETA_COLORS[hash % ETIQUETA_COLORS.length]
}

export default function ClientPanel({
  conversacion,
  etiquetas,
  etiquetasCliente,
}: {
  conversacion: ConversacionResumen | null
  etiquetas: Etiqueta[]
  etiquetasCliente: Etiqueta[]
}) {
  const { serviceName } = useServiceNames()
  const [citas, setCitas] = useState<Cita[]>([])
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [notas, setNotas] = useState("")
  const [email, setEmail] = useState<string | null>(null)
  const [guardandoNotas, setGuardandoNotas] = useState(false)
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState("")

  const clienteId = conversacion?.cliente_id ?? null

  useEffect(() => {
    if (!clienteId) {
      setCitas([])
      setNotificaciones([])
      setNotas("")
      setEmail(null)
      return
    }
    let activo = true

    async function cargar() {
      const [citasRes, cliente, notifRes] = await Promise.all([
        supabase.from("citas").select("*").eq("cliente_id", clienteId).order("inicio_utc", { ascending: false }).limit(10),
        supabase.from("clientes").select("notas, email").eq("id", clienteId).maybeSingle(),
        supabase
          .from("notificaciones")
          .select("*")
          .eq("cliente_id", clienteId)
          .order("created_at", { ascending: false })
          .limit(5),
      ])
      if (!activo) return
      if (citasRes.data) setCitas(citasRes.data as Cita[])
      if (notifRes.data) setNotificaciones(notifRes.data as Notificacion[])
      setNotas((cliente.data?.notas as string | null) ?? "")
      setEmail((cliente.data?.email as string | null) ?? null)
    }
    cargar()

    // El bot escribe el resultado del análisis del comprobante justo
    // después de guardar la imagen — sin esto, el panel se queda con el
    // estado "sin_comprobante" hasta que alguien lo recargue a mano.
    const canal = supabase
      .channel(`crm-citas-${clienteId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "citas", filter: `cliente_id=eq.${clienteId}` },
        (payload) => {
          const actualizada = payload.new as Cita
          setCitas((previas) => previas.map((c) => (c.id === actualizada.id ? actualizada : c)))
        },
      )
      .subscribe()

    return () => {
      activo = false
      supabase.removeChannel(canal)
    }
  }, [clienteId])

  async function verComprobante(path: string) {
    const { data, error } = await supabase.storage.from("comprobantes").createSignedUrl(path, 60)
    if (error || !data) {
      toast.error("No se pudo abrir el comprobante.")
      return
    }
    window.open(data.signedUrl, "_blank", "noreferrer")
  }

  async function guardarNotas() {
    if (!clienteId) return
    setGuardandoNotas(true)
    const { error } = await supabase.from("clientes").update({ notas: notas.trim() || null }).eq("id", clienteId)
    setGuardandoNotas(false)
    if (error) toast.error("No se pudieron guardar las notas.")
    else toast.success("Notas guardadas.")
  }

  /** Reutiliza la etiqueta si ya existe (por nombre) y si no, la crea. */
  async function agregarEtiqueta(nombreCrudo: string) {
    if (!clienteId) return
    const nombre = nombreCrudo.trim()
    if (!nombre) return

    let etiqueta = etiquetas.find((e) => e.nombre.toLowerCase() === nombre.toLowerCase())

    if (!etiqueta) {
      const { data, error } = await supabase
        .from("etiquetas")
        .insert({ nombre, color: colorPorNombre(nombre) })
        .select("*")
        .single()
      if (error) {
        toast.error("No se pudo crear la etiqueta.")
        return
      }
      etiqueta = data as Etiqueta
    }

    const { error } = await supabase
      .from("cliente_etiquetas")
      .insert({ cliente_id: clienteId, etiqueta_id: etiqueta.id })
    // 23505 = ya la tenía asignada; no es un error que valga la pena mostrar.
    if (error && error.code !== "23505") {
      toast.error("No se pudo asignar la etiqueta.")
      return
    }
    setNuevaEtiqueta("")
  }

  async function quitarEtiqueta(etiquetaId: string) {
    if (!clienteId) return
    const { error } = await supabase
      .from("cliente_etiquetas")
      .delete()
      .eq("cliente_id", clienteId)
      .eq("etiqueta_id", etiquetaId)
    if (error) toast.error("No se pudo quitar la etiqueta.")
  }

  if (!conversacion) return null

  const disponibles = etiquetas.filter((e) => !etiquetasCliente.some((asignada) => asignada.id === e.id))

  return (
    <aside className="hidden w-80 shrink-0 flex-col overflow-y-auto border-l border-border xl:flex">
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold">{conversacion.cliente_nombre?.trim() || "Sin nombre"}</h3>
        <a
          href={`https://wa.me/${conversacion.cliente_telefono.replace(/\D/g, "")}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted-foreground hover:text-primary"
        >
          {conversacion.cliente_telefono}
        </a>
        {email && <div className="mt-0.5 truncate text-xs text-muted-foreground">{email}</div>}
      </div>

      <section className="border-b border-border px-5 py-4">
        <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Etiquetas</h4>

        <div className="flex flex-wrap gap-1.5">
          {etiquetasCliente.length === 0 && <p className="text-xs text-muted-foreground">Sin etiquetas todavía.</p>}
          {etiquetasCliente.map((e) => (
            <span
              key={e.id}
              className={cn("flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium", ETIQUETA_CLASSES[e.color])}
            >
              {e.nombre}
              <button
                type="button"
                onClick={() => quitarEtiqueta(e.id)}
                className="opacity-60 hover:opacity-100"
                aria-label={`Quitar etiqueta ${e.nombre}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>

        <div className="mt-3 flex gap-1.5">
          <Input
            value={nuevaEtiqueta}
            onChange={(e) => setNuevaEtiqueta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                void agregarEtiqueta(nuevaEtiqueta)
              }
            }}
            placeholder="Nueva etiqueta…"
            className="h-8 text-xs"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2"
            onClick={() => agregarEtiqueta(nuevaEtiqueta)}
            disabled={!nuevaEtiqueta.trim()}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>

        {disponibles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {disponibles.slice(0, 8).map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => agregarEtiqueta(e.nombre)}
                className="rounded border border-dashed border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:border-solid hover:text-foreground"
              >
                + {e.nombre}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="border-b border-border px-5 py-4">
        <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Notas internas</h4>
        <Textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={3}
          placeholder="Preferencias, alergias, historial…"
          className="resize-none text-xs"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2 w-full"
          onClick={guardarNotas}
          disabled={guardandoNotas}
        >
          Guardar notas
        </Button>
      </section>

      <section className="border-b border-border px-5 py-4">
        <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Citas</h4>
        {citas.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin citas registradas.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {citas.map((c) => (
              <li key={c.id} className="text-xs">
                <div className="font-medium">{serviceName(c.servicio_id)}</div>
                <div className="text-muted-foreground">
                  {formatearCita(c.inicio_utc)} · {CITA_ESTADO_LABEL[c.estado]}
                </div>
                {c.comprobante_estado !== "sin_comprobante" && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium",
                        c.comprobante_estado === "confirmado"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
                      )}
                    >
                      {COMPROBANTE_ESTADO_LABEL[c.comprobante_estado]}
                      {c.comprobante_monto_detectado != null && ` · S/ ${c.comprobante_monto_detectado}`}
                    </span>
                    {c.comprobante_path && (
                      <button
                        type="button"
                        onClick={() => verComprobante(c.comprobante_path!)}
                        className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary"
                      >
                        <ImageIcon className="size-3" />
                        Ver
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {notificaciones.length > 0 && (
        <section className="px-5 py-4">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <Bell className="size-3" />
            Notificaciones
          </h4>
          <ul className="flex flex-col gap-2">
            {notificaciones.map((n) => (
              <li key={n.id} className="text-xs">
                <div className="font-medium">
                  {n.tipo === "recordatorio_cita" ? "Recordatorio de cita" : "Promoción"}
                </div>
                <div className={cn("text-muted-foreground", n.estado === "fallida" && "text-destructive")}>
                  {n.estado === "enviada" && n.enviada_at
                    ? `Enviada ${formatearCita(n.enviada_at)}`
                    : n.estado === "fallida"
                      ? `Falló: ${n.error ?? "error desconocido"}`
                      : "Pendiente"}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  )
}
