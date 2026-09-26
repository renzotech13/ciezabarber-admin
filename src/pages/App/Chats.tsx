import { useState } from "react"
import { Megaphone } from "lucide-react"
import { cn } from "@/lib/utils"
import ConversationList from "@/pages/CRM/ConversationList"
import ChatThread from "@/pages/CRM/ChatThread"
import PromoDialog from "@/pages/CRM/PromoDialog"
import { FILTROS_INBOX, useInbox } from "@/pages/CRM/useInbox"
import { Input } from "@/components/ui/input"

/**
 * Las conversaciones del bot en formato app: la lista ocupa toda la pantalla
 * y al tocar un chat se abre el hilo encima, con flecha para volver — en un
 * celular no caben lista + hilo + ficha lado a lado como en el CRM.
 *
 * Es la misma información y los mismos controles (responder yo / dejar al
 * bot) que en escritorio; solo cambia el marco. Lo comparten useInbox y los
 * componentes del CRM, así que no hay una segunda lógica que mantener.
 */
export default function Chats() {
  const {
    conversaciones, filtradas, etiquetas, etiquetasPorCliente, loading,
    filtro, setFiltro, busqueda, setBusqueda, sinResponder, conHumano,
  } = useInbox()
  const [abiertaId, setAbiertaId] = useState<string | null>(null)
  const [promoAbierto, setPromoAbierto] = useState(false)

  const abierta = conversaciones.find((c) => c.id === abiertaId) ?? null

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="brand-display text-[26px]">Chats</h1>
          <p className="brand-serif text-[12px] text-muted-foreground">
            {loading ? "Cargando…" : `${sinResponder} sin responder · ${conHumano} con una persona`}
          </p>
        </div>
        <button
          onClick={() => setPromoAbierto(true)}
          aria-label="Enviar promoción"
          className="chip23 inline-flex items-center gap-1.5 py-2.5"
        >
          <Megaphone className="size-3.5" /> Promo
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTROS_INBOX.map((f) => (
          <button key={f.key} onClick={() => setFiltro(f.key)} className={cn("chip23", filtro === f.key && "on")}>
            {f.label}
          </button>
        ))}
      </div>

      <Input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar nombre, teléfono o mensaje…"
        className="h-11"
      />

      <div className="-mx-4 border-y border-border bg-card">
        <ConversationList
          conversaciones={filtradas}
          etiquetasPorCliente={etiquetasPorCliente}
          seleccionadaId={null}
          onSeleccionar={setAbiertaId}
          loading={loading}
          className="flex w-full flex-col"
        />
      </div>

      {abierta && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background pt-[env(safe-area-inset-top)]">
          <ChatThread conversacion={abierta} onVolver={() => setAbiertaId(null)} />
        </div>
      )}

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
