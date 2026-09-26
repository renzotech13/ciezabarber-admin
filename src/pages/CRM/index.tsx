import { useState } from "react"
import { Megaphone } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import ConversationList from "./ConversationList"
import ChatThread from "./ChatThread"
import ClientPanel from "./ClientPanel"
import PromoDialog from "./PromoDialog"
import { FILTROS_INBOX, useInbox } from "./useInbox"

export default function CRM() {
  const {
    conversaciones, filtradas, etiquetas, etiquetasPorCliente, loading,
    filtro, setFiltro, busqueda, setBusqueda, sinResponder, conHumano,
  } = useInbox()
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null)
  const [promoAbierto, setPromoAbierto] = useState(false)

  // Si la seleccionada se sale del filtro, se cae a la primera visible en
  // vez de dejar el panel derecho apuntando a algo que ya no está en lista.
  const seleccionada = filtradas.find((c) => c.id === seleccionadaId) ?? filtradas[0] ?? null

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
          <div className="flex flex-wrap gap-2">
            {FILTROS_INBOX.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFiltro(f.key)}
                className={cn("chip23", filtro === f.key && "on")}
              >
                {f.label}
              </button>
            ))}
          </div>
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
