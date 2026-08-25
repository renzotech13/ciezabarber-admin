import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Megaphone } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { ClienteEtiqueta, ConversacionResumen, Etiqueta } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ConversationList from "./ConversationList"
import ChatThread from "./ChatThread"
import ClientPanel from "./ClientPanel"
import PromoDialog from "./PromoDialog"
import { esperaRespuesta } from "./utils"

type Filtro = "todas" | "atencion" | "humano"

const FILTROS: { key: Filtro; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "atencion", label: "Sin responder" },
  { key: "humano", label: "Con humano" },
]

export default function CRM() {
  const [conversaciones, setConversaciones] = useState<ConversacionResumen[]>([])
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([])
  const [clienteEtiquetas, setClienteEtiquetas] = useState<ClienteEtiqueta[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>("todas")
  const [busqueda, setBusqueda] = useState("")
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null)
  const [promoAbierto, setPromoAbierto] = useState(false)

  useEffect(() => {
    let activo = true

    async function cargar() {
      const [conv, etq, clienteEtq] = await Promise.all([
        supabase.from("conversaciones_resumen").select("*").order("actividad_at", { ascending: false }).limit(200),
        supabase.from("etiquetas").select("*").order("nombre"),
        supabase.from("cliente_etiquetas").select("cliente_id, etiqueta_id"),
      ])
      if (!activo) return

      if (conv.error || etq.error || clienteEtq.error) {
        toast.error("No se pudieron cargar las conversaciones.")
      } else {
        setConversaciones(conv.data as ConversacionResumen[])
        setEtiquetas(etq.data as Etiqueta[])
        setClienteEtiquetas(clienteEtq.data as ClienteEtiqueta[])
      }
      setLoading(false)
    }
    cargar()

    // Un mensaje nuevo cambia el orden y el preview del inbox, y el switch
    // bot/humano cambia el estado: ambos eventos recargan el resumen.
    const canal = supabase
      .channel("crm-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "mensajes" }, () => cargar())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversaciones" }, () => cargar())
      .on("postgres_changes", { event: "*", schema: "public", table: "cliente_etiquetas" }, () => cargar())
      .subscribe()

    return () => {
      activo = false
      supabase.removeChannel(canal)
    }
  }, [])

  const etiquetasPorCliente = useMemo(() => {
    const porId = new Map(etiquetas.map((e) => [e.id, e]))
    const mapa = new Map<string, Etiqueta[]>()
    for (const rel of clienteEtiquetas) {
      const etiqueta = porId.get(rel.etiqueta_id)
      if (!etiqueta) continue
      const actuales = mapa.get(rel.cliente_id) ?? []
      actuales.push(etiqueta)
      mapa.set(rel.cliente_id, actuales)
    }
    return mapa
  }, [etiquetas, clienteEtiquetas])

  const filtradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    return conversaciones.filter((c) => {
      if (filtro === "atencion" && !esperaRespuesta(c)) return false
      if (filtro === "humano" && c.estado !== "escalada") return false
      if (!termino) return true
      return (
        (c.cliente_nombre ?? "").toLowerCase().includes(termino) ||
        c.cliente_telefono.includes(termino) ||
        (c.ultimo_contenido ?? "").toLowerCase().includes(termino)
      )
    })
  }, [conversaciones, filtro, busqueda])

  // Si la seleccionada se sale del filtro, se cae a la primera visible en
  // vez de dejar el panel derecho apuntando a algo que ya no está en lista.
  const seleccionada = filtradas.find((c) => c.id === seleccionadaId) ?? filtradas[0] ?? null

  const sinResponder = conversaciones.filter(esperaRespuesta).length
  const conHumano = conversaciones.filter((c) => c.estado === "escalada").length

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border px-6 py-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Conversaciones</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading
                ? "Cargando…"
                : `${conversaciones.length} en total · ${sinResponder} sin responder · ${conHumano} atendidas por una persona`}
            </p>
          </div>
          <Button variant="outline" onClick={() => setPromoAbierto(true)} className="gap-2">
            <Megaphone className="size-4" />
            Enviar promoción
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
            <TabsList>
              {FILTROS.map((f) => (
                <TabsTrigger key={f.key} value={f.key}>
                  {f.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, teléfono o mensaje…"
            className="h-9 max-w-xs"
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <ConversationList
          conversaciones={filtradas}
          etiquetasPorCliente={etiquetasPorCliente}
          seleccionadaId={seleccionada?.id ?? null}
          onSeleccionar={setSeleccionadaId}
          loading={loading}
        />
        <ChatThread conversacion={seleccionada} />
        <ClientPanel
          conversacion={seleccionada}
          etiquetas={etiquetas}
          etiquetasCliente={seleccionada ? (etiquetasPorCliente.get(seleccionada.cliente_id) ?? []) : []}
        />
      </div>

      <PromoDialog
        open={promoAbierto}
        onOpenChange={setPromoAbierto}
        etiquetas={etiquetas}
        etiquetasPorCliente={etiquetasPorCliente}
        conversaciones={conversaciones}
      />
    </div>
  )
}
