import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import type { ClienteEtiqueta, ConversacionResumen, Etiqueta } from "@/lib/types"
import { esperaRespuesta } from "./utils"

export type FiltroInbox = "todas" | "atencion" | "humano"

export const FILTROS_INBOX: { key: FiltroInbox; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "atencion", label: "Sin responder" },
  { key: "humano", label: "Con humano" },
]

/**
 * El inbox de conversaciones del bot, compartido por el CRM de escritorio y
 * la app móvil: carga, se mantiene al día por realtime y aplica filtro y
 * búsqueda. Un solo lugar, para que las dos pantallas no se desincronicen.
 */
export function useInbox() {
  const [conversaciones, setConversaciones] = useState<ConversacionResumen[]>([])
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([])
  const [clienteEtiquetas, setClienteEtiquetas] = useState<ClienteEtiqueta[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<FiltroInbox>("todas")
  const [busqueda, setBusqueda] = useState("")

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
      .channel(`crm-inbox-${Math.random().toString(36).slice(2, 8)}`)
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

  return {
    conversaciones,
    filtradas,
    etiquetas,
    etiquetasPorCliente,
    loading,
    filtro,
    setFiltro,
    busqueda,
    setBusqueda,
    sinResponder: conversaciones.filter(esperaRespuesta).length,
    conHumano: conversaciones.filter((c) => c.estado === "escalada").length,
  }
}
